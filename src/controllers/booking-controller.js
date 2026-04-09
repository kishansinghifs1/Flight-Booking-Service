const {StatusCodes}=require('http-status-codes');
const {BookingService}=require('../services');
 const {ErrorResponse, SuccessResponse}=require('../utils/common');
 const inMemDb = {};
 async function createBooking(req,res){
    try{
        const response =await BookingService.createBooking({
            flightId: req.body.flightId,
            userId:req.body.userId,
            noOfSeats:req.body.noOfSeats
        });
         SuccessResponse.data = response;
        return res
        .status(StatusCodes.OK)
        .json(SuccessResponse);
    }catch(error){
        ErrorResponse.error = error;
        return res
        .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
        .json(ErrorResponse);
    }
}
async function makePayment(req,res){
    try{
         const idempotencyKey = req.headers['x-idempotency-key'];
        if(!idempotencyKey ) {
            return res
                .status(StatusCodes.BAD_REQUEST)
                .json({message: 'idempotency key missing'});
        }
        if(inMemDb[idempotencyKey]) {
            return res
                .status(StatusCodes.BAD_REQUEST)
                .json({message: 'Cannot retry on a successful payment'});
        } 
        const response =await BookingService.makePayment({
           totalCost:req.body.totalCost,
            userId:req.body.userId,
            bookingId:req.body.bookingId,
            metadata:req.body.metadata
        });
         inMemDb[idempotencyKey] = idempotencyKey;
         SuccessResponse.data = response;
        return res
        .status(StatusCodes.OK)
        .json(SuccessResponse);
    }catch(error){
        ErrorResponse.error = error;
        return res
        .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
        .json(ErrorResponse);
    }
}
async function getBookings(req, res) {
    try {
        // userId should ideally come from auth middleware, but we can extract it from query as a fallback
        const userId = req.query.userId || req.body.userId;
        const response = await BookingService.getUserBookings(userId);
        SuccessResponse.data = response;
        return res
            .status(StatusCodes.OK)
            .json(SuccessResponse);
    } catch (error) {
        ErrorResponse.error = error;
        return res
            .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
            .json(ErrorResponse);
    }
}
module.exports ={
    createBooking,
    makePayment,
    getBookings
}