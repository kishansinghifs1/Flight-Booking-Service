const amqplib=require("amqplib");
const ServerConfig = require('./server-config');
let channel,connection;
async function connectQueue(){
    try {
         if (channel) {
            return channel;
         }
         connection =await amqplib.connect(ServerConfig.RABBITMQ_URL);
         connection.on('error', (error) => {
            console.log(error);
         });
         connection.on('close', () => {
            channel = null;
            connection = null;
         });
         channel =await connection.createChannel();

       await channel.assertQueue(ServerConfig.RABBITMQ_QUEUE);
       return channel;
    } catch (error) {
       channel = null;
       connection = null;
       console.log(error) ;
       throw error;
    }
}
async function sendData(data){
    try {
        if (!channel) {
            await connectQueue();
        }
        if (!channel) {
            return false;
        }
        await channel.sendToQueue(ServerConfig.RABBITMQ_QUEUE,Buffer.from(JSON.stringify(data)));
        return true;
    } catch (error) {
        console.log(error);
        return false;
    }
}
module.exports={
    connectQueue,
    sendData
}