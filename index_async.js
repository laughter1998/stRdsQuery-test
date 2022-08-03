const http = require('http');
const https = require('https');
const AWS = require('aws-sdk');
const mysql = require("./mysql.js");



exports.handler =  async function(event, context) {
    context.callbackWaitsForEmptyEventLoop = false;
   
    const connection = await mysql.connection();
   
    try {
        console.log("1👌");
        const row2 = await connection.query("SELECT count(*) as qty  FROM   ls_charger  where batteryIO = 'I' and  stationId='OS10121083000002' and (chargingSequence = 'COMPLETE' and batSoc > '950')");
        console.log(row2);
        console.log("2✌")
        return row2;
        
    } catch (err){
        // await connection.query("ROLLBACK");
        console.log('ROLLBACK at querySignUp', err);
        //Use ROLLBACK query at catch block for error handling.
    } finally {
        await connection.release();
    }
    
}