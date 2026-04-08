const amqplib=require("amqplib");
const ServerConfig = require('./server-config');
let channel,connection;
async function connectQueue(){
    try {
         connection =await amqplib.connect(ServerConfig.RABBITMQ_URL);
         channel =await connection.createChannel();

       await channel.assertQueue(ServerConfig.RABBITMQ_QUEUE);
    } catch (error) {
       console.log(error) ;
       throw error;
    }
}
async function sendData(data){
    try {
        if (!channel) {
            return;
        }
        await channel.sendToQueue(ServerConfig.RABBITMQ_QUEUE,Buffer.from(JSON.stringify(data)));
    } catch (error) {
        console.log(error);
    }
}
module.exports={
    connectQueue,
    sendData
}