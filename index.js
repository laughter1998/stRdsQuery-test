const http = require('http');
const https = require('https');
const AWS = require('aws-sdk');
const mysql = require("./mysql.js");
// 깃 테스트3


exports.handler =  async function(event, context) {
    context.callbackWaitsForEmptyEventLoop = false;

    const connection = await mysql.connection();

    try {

        var sqlplus = "";
        var notype = "0";
        var update_key = []; // event<<아닌 status 등 정기보고용
        var update_val = [];
        var type = event['type'];
        var stationId = event['stationId'];
        var apkVersion = event['apkVersion'];
        var cmdresult = event['result'];
        var cmdId = event['cmdId'];
        var chargerStatus = event['chargerStatus'];
        var batteryStatus = event['batteryStatus'];
        var keys = Object.keys(event);
        keys.forEach(function(val, key) {
            if (val != "chargerStatus" && val != "batteryStatus" && val != "acStatus" && val != "enviroStatus") {
                update_key.push(val);

                if (JSON.stringify(event[val]).indexOf('{') != -1) {
                    //	console.log(JSON.stringify(event[val]).indexOf(':'));
                    update_val.push(JSON.stringify(event[val]));
                } else {
                    update_val.push((event[val]));
                }
            }

        });
        var i = 0;
        var result = [];
        update_key.forEach(function(item, index) {
            sqlplus += "," + item + " =? ";
            result[i] = (update_val[i]);
            i++;
        });

        var event_key = []; // 충격등 이벤트보고용
        var event_val = [];
        i = 0;
        keys.forEach(function(val, key) {
            if (i > 1) {
                event_key.push(val);
                //console.log("eventkey:"+val);

                if (JSON.stringify(event[val]).indexOf('{') != -1) {
                    //	console.log(JSON.stringify(event[val]).indexOf(':'));
                    event_val.push(JSON.stringify(event[val]));
                } else {
                    event_val.push((event[val]));
                }
            }
            i++;
        });
        console.log(event_val);


        console.log("1👌");
        const row2 = await connection.query("SELECT count(*) as qty  FROM   ls_charger  where batteryIO = 'I' and  stationId='OS10121083000002' and (chargingSequence = 'COMPLETE' and batSoc > '950')");
        console.log(row2);
        console.log("2✌")
        var paymoneyv = 0; // 일단 테스트라 10원만
        var payType = "";
        var jsonPayType = new Object();
        jsonPayType = {
            result: "CONTROL",
            payMoney: paymoneyv
        };
        return jsonPayType;

    } catch (err){
        // await connection.query("ROLLBACK");
        console.log('ROLLBACK at querySignUp', err);
        //Use ROLLBACK query at catch block for error handling.
    } finally {
        await connection.release();
        //connection.destory() 이거 해야함?? 왜????
        // https://cdmana.com/2022/03/202203290503488479.html 이거 맞음???
    }

}
