const dotenv=require('dotenv');

dotenv.config();

const defaultAuthService = process.env.NODE_ENV === 'production'
    ? 'http://api-gateway:3000'
    : 'http://localhost:3000';

module.exports={
    PORT: process.env.PORT,
    FLIGHT_SERVICE:process.env.FLIGHT_SERVICE,
    AUTH_SERVICE: process.env.AUTH_SERVICE || defaultAuthService,
    RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672',
    RABBITMQ_QUEUE: process.env.RABBITMQ_QUEUE || 'noti-queue'
}