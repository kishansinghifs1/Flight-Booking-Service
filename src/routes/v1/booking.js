const express = require('express');
const { BookingController } = require('../../controllers');

const router = express.Router();

router.post('/', BookingController.createBooking);
router.get('/', BookingController.getBookings);
router.post('/payments', BookingController.makePayment);

module.exports = router;