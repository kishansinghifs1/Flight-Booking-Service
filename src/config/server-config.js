const dotenv=require('dotenv');

dotenv.config();
module.exports={
    PORT: process.env.PORT,
    FLIGHT_SERVICE:process.env.FLIGHT_SERVICE,
    RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672',
    RABBITMQ_QUEUE: process.env.RABBITMQ_QUEUE || 'noti-queue'
}