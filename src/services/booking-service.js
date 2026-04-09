const axios = require("axios");
const { StatusCodes } = require("http-status-codes");

const { BookingRepository } = require("../repositories");
const { ServerConfig, Queue } = require("../config");
const db = require("../models");
const AppError = require("../utils/errors/app-error");
const { Enums } = require('../utils/common');
const { BOOKED, CANCELLED } = Enums.BOOKING_STATUS;

const bookingRepository = new BookingRepository();

function buildPassengerName(userProfile = {}) {
  if (typeof userProfile.fullName === 'string' && userProfile.fullName.trim()) {
    return userProfile.fullName.trim();
  }

  const firstName = typeof userProfile.firstName === 'string' ? userProfile.firstName.trim() : '';
  const lastName = typeof userProfile.lastName === 'string' ? userProfile.lastName.trim() : '';
  const merged = `${firstName} ${lastName}`.trim();
  if (merged) return merged;

  if (typeof userProfile.email === 'string' && userProfile.email.includes('@')) {
    return userProfile.email.split('@')[0];
  }

  return 'Passenger';
}

function getAirportLocationName(airport = {}) {
  const cityFromLower = airport.city && typeof airport.city.name === 'string' ? airport.city.name : '';
  if (cityFromLower) return cityFromLower;

  const cityFromUpper = airport.City && typeof airport.City.name === 'string' ? airport.City.name : '';
  if (cityFromUpper) return cityFromUpper;

  if (typeof airport.name === 'string' && airport.name.trim()) {
    return airport.name.trim();
  }

  if (typeof airport.code === 'string' && airport.code.trim()) {
    return airport.code.trim();
  }

  return 'Unknown';
}

async function createBooking(data) {
  const transaction = await db.sequelize.transaction();
  try {
    const flight = await axios.get(`${ServerConfig.FLIGHT_SERVICE}/api/v1/flights/${data.flightId}`);
    const flightData = flight.data.data;
    if (data.noOfSeats > flightData.totalSeats) {
      throw new AppError("Not enough seats available", StatusCodes.BAD_REQUEST);
    }
    const totalBillingAmount = data.noOfSeats * flightData.price;
    const bookingPayload = { ...data, totalCost: totalBillingAmount };
    const booking = await bookingRepository.createBooking(bookingPayload, transaction);

    await axios.patch(`${ServerConfig.FLIGHT_SERVICE}/api/v1/flights/${data.flightId}/seats`, {
      seats: data.noOfSeats
    });

    await transaction.commit();
    return booking;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function makePayment(data) {
  const transaction = await db.sequelize.transaction();
  try {
    const bookingDetails = await bookingRepository.get(data.bookingId, transaction);
    
    if (bookingDetails.status == CANCELLED) {
      throw new AppError('The booking has expired', StatusCodes.BAD_REQUEST);
    }
    const bookingTime = new Date(bookingDetails.createdAt);
    const currentTime = new Date();
    if (currentTime - bookingTime > 300000) {
      await cancelBooking(data.bookingId);
      throw new AppError('The booking has expired', StatusCodes.BAD_REQUEST);
    }
    if (bookingDetails.totalCost != data.totalCost) {
      throw new AppError("The amount of the payment doesnt match", StatusCodes.BAD_REQUEST);
    }
    if (bookingDetails.userId != data.userId) {
      throw new AppError("The user corresponding to the booking doesnt match", StatusCodes.BAD_REQUEST);
    }

    // Update booking status to CONFIRMED (BOOKED)
    // Fetch user and flight details for notification
    const user = await axios.get(`${ServerConfig.AUTH_SERVICE}/api/v1/user/${data.userId}`);
    const userProfile = user.data.data || {};
    const userEmail = userProfile.email;
    const passengerName = buildPassengerName(userProfile);

    if (!userEmail) {
      throw new AppError('User email missing for notification', StatusCodes.BAD_REQUEST);
    }

    const updateData = { status: BOOKED };
    const incomingMetadata = (data.metadata && typeof data.metadata === 'object') ? data.metadata : {};
    const existingMetadata = (bookingDetails.metadata && typeof bookingDetails.metadata === 'object') ? bookingDetails.metadata : {};
    updateData.metadata = {
      ...existingMetadata,
      ...incomingMetadata,
      passengerName,
      passengerFirstName: userProfile.firstName || null,
      passengerLastName: userProfile.lastName || null,
      passengerEmail: userEmail
    };

    if (updateData.metadata.seats) {
      updateData.seats = updateData.metadata.seats;
    }

    await bookingRepository.update(data.bookingId, updateData, transaction);

    const flight = await axios.get(`${ServerConfig.FLIGHT_SERVICE}/api/v1/flights/${bookingDetails.flightId}`);
    const flightData = flight.data.data;
    const originName = getAirportLocationName(flightData.departureAirport || {});
    const destinationName = getAirportLocationName(flightData.arrivalAirport || {});

    // Randomization logic for boarding pass details
    const gates = ['A', 'B', 'C', 'D'];
    const randomGate = gates[Math.floor(Math.random() * gates.length)] + Math.floor(Math.random() * 20 + 1);
    
    const seatLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const randomSeat = Math.floor(Math.random() * 30 + 1) + seatLetters[Math.floor(Math.random() * seatLetters.length)];

    const departureTime = new Date(flightData.departureTime);
    const boardingTime = new Date(departureTime.getTime() - 45 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Send data to notification queue
    Queue.sendData({
      recepientEmail: userEmail,
      subject: 'Flight Booked Successfully',
      text: `Your flight AI-${flightData.flightNumber} from ${originName} to ${destinationName} is confirmed.`,
      flightDetails: {
        flightNumber: flightData.flightNumber,
        origin: originName,
        destination: destinationName,
        departureTime: departureTime.toLocaleString(),
        arrivalTime: new Date(flightData.arrivalTime).toLocaleString(),
        boardingGate: randomGate,
        boardingTime: boardingTime,
        seatNumber: randomSeat,
        passengerName,
        passengerFirstName: userProfile.firstName || null,
        passengerLastName: userProfile.lastName || null,
        passengerEmail: userEmail
      }
    });

    await transaction.commit();
    return {
      bookingId: data.bookingId,
      status: BOOKED,
      passengerName
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function cancelBooking(bookingId) {
  const transaction = await db.sequelize.transaction();
  try {
    const bookingDetails = await bookingRepository.get(bookingId, transaction);
    if (bookingDetails.status == CANCELLED) {
      await transaction.commit();
      return true;
    }
    await axios.patch(`${ServerConfig.FLIGHT_SERVICE}/api/v1/flights/${bookingDetails.flightId}/seats`, {
      seats: bookingDetails.noOfSeats,
      dec: 0
    });
    await bookingRepository.update(bookingId, { status: CANCELLED }, transaction);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function getUserBookings(userId) {
  try {
    const response = await bookingRepository.getByUserId(userId);
    return response;
  } catch (error) {
    throw error;
  }
}

async function cancelOldBookings() {
  try {
    const time = new Date(Date.now() - 1000 * 300); // 5 mins ago
    const response = await bookingRepository.cancelOldBookings(time);
    return response;
  } catch (error) {
    console.log(error);
  }
}

module.exports = {
  createBooking,
  makePayment,
  getUserBookings,
  cancelOldBookings
};
