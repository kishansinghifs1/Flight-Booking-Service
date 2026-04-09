const express=require('express');



const {ServerConfig,Queue}=require('./config');
const apiRoutes=require('./routes');
const CRON = require('./utils/common/cron-jobs');
const QUEUE_RETRY_MS = Number(process.env.RABBITMQ_RETRY_MS || 3000);

const app=express();

 app.use(express.json());
 app.use(express.urlencoded({extended:true}));
 app.use('/api',apiRoutes);

let queueConnectTimer = null;

async function connectQueueWithRetry() {
    try {
        await Queue.connectQueue();
        console.log('Queue connected');
        return;
    } catch (error) {
        console.log(`Queue connection failed. Retrying in ${QUEUE_RETRY_MS}ms`);
        if (queueConnectTimer) {
            clearTimeout(queueConnectTimer);
        }
        queueConnectTimer = setTimeout(connectQueueWithRetry, QUEUE_RETRY_MS);
    }
}

app.listen(ServerConfig.PORT,async()=>{
    console.log(`Server is running on port: ${ServerConfig.PORT}`);
    CRON();
    await connectQueueWithRetry();
});