const mysql = require('mysql');
const config = require('./config.json');
const http = require('http');
const https = require('https');
const firebase = require("firebase-admin");

const AWS = require('aws-sdk');

//람다 타임아웃, socketHangUp방지 위한 설정 220705
//AWS.config.update({
//    maxRetries: 2,
//    httpOptions: {
//        timeout: 30000,
//        connectTimeout: 5000
//    }
//});

const dynamodb = new AWS.DynamoDB.DocumentClient();

const mysqlPool = mysql.createPool({
    host: config.npd.host,
    user: config.npd.user,
    password: config.npd.password,
    database: config.npd.database,
    connectionLimit: 500,
    multipleStatements: true
});
const createResponse = (status, body) => ({
    statusCode: status,
    body: (body)
});
const serviceAccount = require("./serviceAccountKey.json");
firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount),
    databaseURL: "https://otos1-baf45-default-rtdb.firebaseio.com"
});
process.on('uncaughtException', function (err) {
      console.error(err.stack);
      console.log("Node NOT Exiting...");
 });

exports.handler = function(event, context, callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    mysqlPool.getConnection(function(err, connection) {
        if (err !== null) return console.log(createResponse(500, {
            message: err
        }));

        //   connection.query('SELECT 1 AS RESULT', function(error,results,field) {
        //   if(connection) return connection.release();


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




        if (type == "RESULT") {

            notype = 1;

            if (cmdresult == "OK") {

                var sql = 'update ls_command set success_dtm = date_add(now(), interval 9 hour), successyn="Y" where cmdId=? and stationId=?';
                var params = [cmdId, stationId];
                connection.query(sql, params, function(err, rows, fields) {

                    if (err) console.log(err);
                    callback(null, {
                        result: 'OK'
                    });


                });
            } else {
                callback(null, {
                    result: 'NOK'
                });

            }

            if (connection) connection.release();
        }

        

        if (type == "COMMAND") {
		
	    notype = 1;

            var rjson = new Object();
            var ajson = new Object();
            var stationId = event['stationId'];
            var type = event['type'];
            var cmdId = event['cmdId'];

            if (stationId && cmdId) {

                var parma = [cmdId, stationId];
                var sql = 'update ls_command set reqinfo_dtm = date_add(now(), interval 9 hour) where cmdId = ? and stationId = ? ';
                connection.query(sql, parma, function(err, rows, fields) {
                    if (err) console.log(err);
                });

                var sql = "select cmdData,cmdDataResult from ls_command where cmdId = ? and stationId = ? ";
                connection.query(sql, parma, function(err, rows, fields) {
                    if (err) console.log(err);
                    for (var i = 0; i < rows.length; i++) {
                        //ajson[rows[i].cmdData] =   JSON.stringify(rows[i].cmdDataResult).replace(/\\/g, '');
                        ajson[rows[i].cmdData] = (rows[i].cmdDataResult);
                        //console.log(rows[i].cmdData);
                    }
                    rjson.stationId = stationId;
                    rjson.result = "CONTROL"; //command 내용 전달시 추가해달라고 함 2021.06.10
                    rjson.cmdId = cmdId;
                    rjson.cmdData = ajson;
                    //callback(null, createResponse(200, rjson));
                    callback(null, rjson);

                });


            }

            if (connection) connection.release();
        }

        if (type == "CONTROL") {
	   
	    notype = 1;

            var rjson = [];
            var ajson = new Object();
            var stationId = event['stationId'];
            var type = event['type'];
            var cmdId = event['cmdId'];

            if (stationId && cmdId) {

                var parma = [cmdId];
                var sql = 'update ls_command set reqinfo_dtm = date_add(now(), interval 9 hour) where cmdId = ?   ';
                connection.query(sql, parma, function(err, rows, fields) {
                    if (err) console.log(err);
                });

                var sql = "select cmdData,cmdDataResult from ls_command where cmdId = ?  ";
                connection.query(sql, parma, function(err, rows, fields) {
                    if (err) console.log(err);
                    ajson["result"] = "CONTROL";
                    //rjson.push(JSON.parse(rows[0].cmdDataResult.replace('[', '').replace(']','')));

                    var resu = rows[0].cmdDataResult.replace('[', '').replace(']', '');
                    var resu2 = rows[0].cmdDataResult;

                    if (resu.indexOf('{') !== -1) {
                        if (rows[0].cmdData == "setLed" || rows[0].cmdData == "setCharge" || rows[0].cmdData == "setBMS" || rows[0].cmdData == "setLock" || rows[0].cmdData == "setIgnoreSocket") {
                            ajson[rows[0].cmdData] = JSON.parse(resu2);
                        } else {
                            ajson[rows[0].cmdData] = JSON.parse(resu);
                        }
                    } else {
                        ajson[rows[0].cmdData] = (resu2);
                    }
                    console.log(ajson);
                    callback(null, ajson);

                });


            }
            if (connection) connection.release();


        }

        if (type == "INFO") { // station

            notype = 1;


            var sql = 'insert into ls_station_his set ent_dtm = date_add(now(), interval 9 hour) ' + sqlplus;
            connection.query(sql, result, function(err, rows, fields) {

                if (err) console.log(err);

            });


            result[i] = stationId;

            var sql = 'update ls_station set mod_dtm = date_add(now(), interval 9 hour) ' + sqlplus + ' where stationId = ? ';
            connection.query(sql, result, function(err, rows, fields) {

                if (err) console.log(err);
                //else callback(null,"OK");  
            });



            if (apkVersion) {
                var sql = 'SELECT if((select count(*) from ls_station where stationId = ?)>0, if((select count(*) from ls_station where stationId = ? and apkVersion <' + apkVersion + ')>0,\'INSTALL\',\'OK\'),\'NOK\') as resu ';
                var params = [stationId, stationId];
                connection.query(sql, params, function(err, rows, fields) {
                    if (err) {
                        console.log("error:" + err);
                    } else {
                        console.log("apk" + apkVersion);
                        console.log("result- " + rows[0].resu);
                        if (rows[0].resu == "OK") {

                            var sql2 = 'SELECT reportPeriod,warnBatTakeTo,errBatTakeTo,warnPayTo,errPayTo,  warnAlarmHi,errAlarmHi,warnAlarmLo,errAlarmLo, targetHi,targetLo , pchg_bat_temp, pchg_cur, chg_vol, chg_cur, payType from ls_station where stationId = ? and stationId = ? ';

                            console.log("sql-" + sql2);
                            connection.query(sql2, params, function(err2, rows2, fields2) {
                                if (err2) {
                                    console.log("error:" + err2);
                                } else {



                                    var stationCfg = {
                                        reportPeriod: rows2[0].reportPeriod,
                                        warnBatTakeTo: rows2[0].warnBatTakeTo,
                                        errBatTakeTo: rows2[0].errBatTakeTo,
                                        warnPayTo: rows2[0].warnPayTo,
                                        errPayTo: rows2[0].errPayTo,
                                        payType: rows2[0].payType
                                    };

                                    var tempCfg = {
                                        warnAlarmHi: rows2[0].warnAlarmHi,
                                        errAlarmHi: rows2[0].errAlarmHi,
                                        warnAlarmLo: rows2[0].warnAlarmLo,
                                        errAlarmLo: rows2[0].errAlarmLo,
                                        targetHi: rows2[0].targetHi,
                                        targetLo: rows2[0].targetLo
                                    };

                                    var chargeCfg = {
                                        pchg_bat_temp: rows2[0].pchg_bat_temp,
                                        pchg_cur: rows2[0].pchg_cur,
                                        chg_vol: rows2[0].chg_vol,
                                        chg_cur: rows2[0].chg_cur
                                    };

                                    var sql3 = 'SELECT id ,status ,sby   from ls_charger where stationId = ? and stationId = ? ';

                                    connection.query(sql3, params, function(err3, rows3, fields3) {

                                        if (err3) {
                                            console.log("error:" + err3);
                                        } else {

                                            //resultarr.push({ignoreSocket: rows3});

                                            var ignoreSocket = rows3;

                                            callback(null, {
                                                "result": "CONFIG",
                                                stationCfg,
                                                tempCfg,
                                                chargeCfg,
                                                ignoreSocket
                                            });

                                        }
                                    });

                                }
                            });




                        } else {
                            callback(null, {
                                result: rows[0].resu
                            });

                        }

                    }
                });
            } else {


                var sql = "SELECT if(select count(*) from ls_station where stationId = ?)>0,'OK','NOK') as resu ";
                var params = [stationId];
                connection.query(sql, params, function(err, rows, fields) {
                    if (err) {
                        console.log("error:" + err);
                    } else {
                        console.log("aok" + apkVersion);
                        callback(null, {
                            result: rows[0].resu
                        });

                    }
                });


            }

            if (connection) connection.release();
        }


        if (type == "STATUS") { 

 
            notype = 1;

            var id = "";
            var keys = Object.keys(event);
            var sqlplus = "";
            var stationId = "";
            keys.forEach(function(key, val) {

                if (key != "chargerStatus" && key != "batteryStatus") {
                    if (key == "stationId") stationId = event[key];
                    if (key == "acStatus") {
                        var acStatus = event[key];
                        var keys_sub2 = Object.keys(acStatus);

                        keys_sub2.forEach(function(key2, val2) {

                            sqlplus += "," + key2 + " = '" + acStatus[key2] + "' ";
                        });
                    } else if (key == "enviroStatus") {
                        var enviroStatus = event[key];
                        var keys_sub2 = Object.keys(enviroStatus);

                        keys_sub2.forEach(function(key2, val2) {

                            sqlplus += "," + key2 + " = '" + enviroStatus[key2] + "' ";
                        });
                    } else {
                        if (JSON.stringify(event[key]).indexOf('{') != -1) {
                            sqlplus += "," + key + " = '" + JSON.stringify(event[key]) + "' ";
                        } else {
                            sqlplus += "," + key + " = '" + (event[key]) + "' ";
                        }


                    }
                }
            });


            var sql = "insert into ls_station_his set ent_dtm = date_add(now(), interval 9 hour) " + sqlplus + "; update ls_charger set batteryIO = 'O' where stationId='" + stationId + "';";
            sql += "update ls_station set ent_dtm = date_add(now(), interval 9 hour) " + sqlplus + " where stationId='" + stationId + "';";
            //console.log("sql-"+sql);


            //	http.get("http://except.otosone.co.kr/fs_sync_php.php?stationId="+stationId); //firebase realtimDB 연결

            var keyv = "";

            var sqlplussub = "";
            if (JSON.stringify(chargerStatus)) {
                var id = "";
                var keys_sub = Object.keys(chargerStatus);

                keys_sub.forEach(function(key, val) {
                    var keys_sub2 = Object.keys(chargerStatus[key]);
                    sqlplussub += " update ls_charger set mod_dtm = date_add(now(), interval 9 hour), batteryIO='I' ";
                    var id = "";
                    keys_sub2.forEach(function(key2, val2) {
                        if (key2 == "id") id = chargerStatus[val][key2];
                        if (key2 == "lock") keyv = "locks";
                        else keyv = key2;
                        sqlplussub += "," + keyv + " = '" + chargerStatus[val][key2] + "' ";
                    });
                    sqlplussub += " where stationId = '" + stationId + "' and type='STATUS' and id='" + id + "'; ";
                });
                firebase.database().ref('/Lamda/' + stationId).set(chargerStatus); //파이어베이스 리얼DB
            }

            // 원복 ls_status   1시간 1번쌓이는것 -> 1분에 한번으로 start==
            var sqlbatterysql = "";
            if (JSON.stringify(batteryStatus)) { // 배터리는 serialNum 로 이력관리만 하면 됨
                var id = "";
                var keys_sub = Object.keys(batteryStatus);

                keys_sub.forEach(function(key, val) {
                    var keys_sub2 = Object.keys(batteryStatus[key]);
                    sqlbatterysql += " insert into ls_battary set reg_dtm = date_add(now(), interval 9 hour), type='STATUS', stationId='" + stationId + "' ";
                    var id = "";
                    keys_sub2.forEach(function(key2, val2) {
                        sqlbatterysql += "," + key2 + " = '" + batteryStatus[val][key2] + "' ";
                    });
                    sqlbatterysql += "; ";

                });

                //http.get("http://except.otosone.co.kr/fs_sync_php.php?stationId="+stationId); //firebase realtimDB 연결

            }

            //console.log(JSON.stringify(sqlbatterysql));
            //var sqltotal = sql+sqlplussub + sqlbatterysql + " insert into ls_status set typev = 'STATUS', stationId = '"+stationId+"', ent_dtm = date_add(now(), interval 9 hour), jsonv='"+JSON.stringify(event)+"'; ";
            // 원복 ls_status   1시간 1번쌓이는것 -> 1분에 한번으로 end==
            //22.6.28 1분에 1번씩 쌓이는 주기정보 mysql에서 aws dynamoDB쌓는걸로 변경
            var sqltotal = sql + sqlplussub + sqlbatterysql;

            //다이나모DB넣기 START 22.6.16 bhj
            process.env.TZ = 'Asia/Seoul';
            var today = new Date(Date.now());
            var daytime = new Date(today.setMinutes(today.getMinutes() - today.getTimezoneOffset()));
            var localeTime = daytime.toISOString().slice(0, 19).replace('T', ' ');
            var localeDate = daytime.toISOString().slice(0, 10);
            var localeHour = daytime.toISOString().substr(11, 8);


            var dynamoPut = {
                Item: {
                    stationId: stationId,
                    type: "STATUS",
                    statusDate: localeDate,
                    statusTime: localeHour,
                    timeStamp: localeTime,
                    data: JSON.stringify(event)
                },
                TableName: "StationStatus",
            }

            dynamodb.put(dynamoPut).promise();
            //다이나모DB넣기 END 22.6.16 bhj


            var resultsub = [];
            connection.query(sqltotal, resultsub, function(err, rows, fields) {
                if (err) console.log(err);
                http.get("http://except.otosone.co.kr/fs_sync_php.php?stationId=" + stationId); //firebase realtimDB 연결 
                callback(null, {
                    result: "OK"
                });

            });

            if (connection) connection.release();
        }

        var addsqltype = type;

        if (type == "EVENT" || type == "NOTIFY") { // 이벤트

 
            notype = 1;
            var sql = "";
            var id = "";
            var type = "";
            var params = [];
            var items = "";
            var soc = 0;
            var keyv = "";
            var sqlplussub = "";
            var batteryInfov = "";
            event_key.forEach(function(item, index) {
                console.log(item + ":" + event_val[index]);
                sql += 'insert into ls_event set ent_dtm = date_add(now(), interval 9 hour), type=?, stationId = ?, allContent=?, eventKey=?, eventVal = ? ; ';
                params.push(type);
                params.push(stationId);
                params.push(JSON.stringify(event));
                params.push(item);
                params.push(event_val[index]);
                items = item;
                if (item == "payResult") {
                    if (event['payResult']['result'] == "OK") {
                        var keys_sub = Object.keys(event['payResult']);
                        sqlplussub = " insert into ls_payresult set ent_dtm = date_add(now(), interval 9 hour),stationId = '" + stationId + "'  ";
                        keys_sub.forEach(function(key, val) {
                            //console.log(","+ key  + " = '"+event['payResult'][key]+"' ");
                            sqlplussub += "," + key + " = '" + event['payResult'][key] + "' ";
                        });
                    } else { // LACK 나 TO 인경우 //"LACK"-잔액부족, "TO"-Timeout 와 같이 잔액부족과 타임아웃 두가지를 받을 경우 PHP 로 보내서 핑때려야함
                        var rkey = Math.floor(Math.random() * (100000 - 1)) + 1;
                        sqlplussub = "insert into la_randomkey set stationId='" + stationId + "',keyv='" + rkey + "',reg_dtm=date_add(now(), interval 9 hour)";
                        connection.query(sqlplussub, "", function(err, rows, fields) {
                            if (err) {
                                console.log("error:" + err);
                            }

                            http.get("http://except.otosone.co.kr/setLock.php?sw=" + stationId + "&sj=" + rkey);
                            callback(null, {
                                result: "CONTROL",
                                payResult: event['payResult']['result']
                            });

                        });


                    }

                }

                if (item == "enviroEvent") {

                    var keys_sub = JSON.parse(event['enviroEvent']);
                    //console.log(item+":"+JSON.stringify(keys_sub)); 
                    sqlplussub += " update ls_station set mod_dtm = now()  ";
                    var keys_sub2 = Object.keys(keys_sub);
                    //console.log(keys_sub2);
                    keys_sub2.forEach(function(key2, val2) {
                        if (key2 == "type") {
                            type = keys_sub[key2];
                        } else {
                            sqlplussub += "," + key2 + " = '" + keys_sub[key2] + "' ";
                        }
                    });

                    sqlplussub += ", enviroEvent ='" + type + "'  where stationId = '" + stationId + "' ; ";
                    console.log(sqlplussub);

                }
                if (item == "systemEvent") {

                    var keys_sub = Object.keys(event['systemEvent']);
                    console.log(item + ":" + JSON.stringify(keys_sub));

                    keys_sub.forEach(function(key, val) {
                        var v = event['systemEvent'];
                        console.log(v);
                        sqlplussub += " update ls_station set mod_dtm = now()  ";
                        var keys_sub2 = Object.keys(v);
                        keys_sub2.forEach(function(key2, val2) {
                            if (key2 == "id") id = event['systemEvent'][key2];
                            if (key2 == "type") type = event['systemEvent'][key2];
                            else sqlplussub += "," + key2 + " = '" + event['systemEvent'][key2] + "' ";
                        });
                        sqlplussub += ", systemEvent ='" + type + "'  where stationId = '" + stationId + "' ; ";
                    });
                    console.log(sqlplussub);


                }
                if (item == "chargerEvent") {

                    var keys_sub = Object.keys(event['chargerEvent']);
                    console.log(item + ":" + JSON.stringify(keys_sub));

                    keys_sub.forEach(function(key, val) {
                        var v = event['chargerEvent'];
                        console.log(v);
                        sqlplussub += " update ls_station set mod_dtm = now()  ";
                        var keys_sub2 = Object.keys(v);
                        keys_sub2.forEach(function(key2, val2) {
                            if (key2 == "id") id = event['chargerEvent'][key2];
                            if (key2 == "type") type = event['chargerEvent'][key2];
                            else sqlplussub += "," + key2 + " = '" + event['chargerEvent'][key2] + "' ";
                        });
                        sqlplussub += ", chargerEvent ='" + type + "'  where stationId = '" + stationId + "' ; ";
                    });
                    console.log(sqlplussub);


                }

                if (item == "chargeStart") {

                    var keys_sub = JSON.parse(event['chargeStart']);
                    //console.log(item+":"+JSON.stringify(keys_sub)); 
                    sqlplussub += " update ls_charger set chargerStatus = 'S'  ";
                    var keys_sub2 = Object.keys(keys_sub);
                    //console.log(keys_sub2);
                    keys_sub2.forEach(function(key2, val2) {
                        if (key2 == "id") {
                            id = keys_sub[key2];
                        } else {
                            if (key2 == "batid") {
                                sqlplussub += ",batSerialNum = '" + keys_sub[key2] + "' ";
                            } else {
                                sqlplussub += "," + key2 + " = '" + keys_sub[key2] + "' ";
                            }
                        }
                    });
                    sqlplussub += " where stationId = '" + stationId + "' and id='" + id + "'; ";
                    console.log(sqlplussub);

                }
                if (item == "chargeDone") {

                    var keys_sub = JSON.parse(event['chargeDone']);
                    //console.log(item+":"+JSON.stringify(keys_sub)); 
                    sqlplussub += " update ls_charger set chargerStatus = 'D'  ";
                    var keys_sub2 = Object.keys(keys_sub);
                    //console.log(keys_sub2);
                    keys_sub2.forEach(function(key2, val2) {
                        if (key2 == "id") {
                            id = keys_sub[key2];
                        } else {
                            if (key2 == "batid") {
                                sqlplussub += ",batSerialNum = '" + keys_sub[key2] + "' ";
                            } else {
                                sqlplussub += "," + key2 + " = '" + keys_sub[key2] + "' ";
                            }
                        }
                    });
                    sqlplussub += " where stationId = '" + stationId + "' and id='" + id + "'; ";
                    console.log(sqlplussub);

                }



                if (item == "batteryIn") {
                    var idsoc = 0;
                    var batid = "";
                    var packv = 0;
                    var packa = 0;

                    var keys_sub = Object.keys(event['batteryIn']['batteryInfo']);
                    //console.log(item+":"+JSON.stringify(event['batteryIn']['batteryInfo']));

                    keys_sub.forEach(function(key, val) {
                        var v = event['batteryIn']['batteryInfo'][key];
                        console.log(v);
                        sqlplussub += " update ls_charger set batteryIO = 'I'  ";
                        var keys_sub2 = Object.keys(v);
                        keys_sub2.forEach(function(key2, val2) {
                            if (key2 == "soc") {
                                idsoc = event['batteryIn']['batteryInfo'][key][key2];
                                soc += event['batteryIn']['batteryInfo'][key][key2];
                                keyv = "batSoc";
                            } else {
                                keyv = key2;
                            }
                            if (key2 == "id") {
                                id = event['batteryIn']['batteryInfo'][key][key2];
                            }
                            if (key2 == "batid") {
                                batid = event['batteryIn']['batteryInfo'][key][key2];
                                keyv = "batSerialNum";
                            }
                            if (key2 == "packv") {
                                packv = event['batteryIn']['batteryInfo'][key][key2];
                                keyv = "chargingVol";
                            }
                            if (key2 == "packa") {
                                packa = event['batteryIn']['batteryInfo'][key][key2];
                                keyv = "chargingCur";
                            }
                            sqlplussub += "," + keyv + " = '" + event['batteryIn']['batteryInfo'][key][key2] + "' ";
                            batteryInfov = event['batteryIn']['batteryInfo'];

                        });
                        sqlplussub += ", time= date_add(now(), interval 9 hour), chargingSequence='PRE_CHARGE'  ,batSoc='" + idsoc + "'  where stationId = '" + stationId + "' and id='" + id + "'; ";
                        //sqlplussub += ", time= date_add(now(), interval 9 hour), chargingSequence='PRE_CHARGE'  ,batSoc='"+idsoc+"' "+sqladd+" where stationId = '"+stationId+"' and id='"+id+"'; ";
                    });
                    //http.get("http://except.otosone.co.kr/fs_sync_php.php?stationId="+stationId); //firebase realtimDB 연결 22.7.4주석 소켓에러관련




                }
                if (item == "batteryOut") {

                    var keys_sub = Object.keys(event['batteryOut']['batteryInfo']);
                    //console.log(item+":"+JSON.stringify(event['batteryOut']['batteryInfo']));

                    keys_sub.forEach(function(key, val) {
                        var v = event['batteryOut']['batteryInfo'][key];
                        console.log(v);
                        sqlplussub += " update ls_charger set batteryIO = 'O'  ";
                        var keys_sub2 = Object.keys(v);
                        keys_sub2.forEach(function(key2, val2) {
                            if (key2 == "id") id = event['batteryOut']['batteryInfo'][key][key2];
                            else sqlplussub += "," + key2 + " = '" + event['batteryOut']['batteryInfo'][key][key2] + "' ";
                        });
                        sqlplussub += ", chargingSequence='IDLE', batSoc = 0   where stationId = '" + stationId + "' and id='" + id + "'; ";
                    });
                    //http.get("http://except.otosone.co.kr/fs_sync_php.php?stationId="+stationId); //firebase realtimDB 연결 22.7.4주석 소켓에러관련


                }
            });

            //sql = sql + " insert into ls_status set typev = '"+addsqltype+"', stationId = '"+stationId+"', ent_dtm = date_add(now(), interval 9 hour), jsonv='"+JSON.stringify(event)+"'; ";
            //console.log("sql - "+sql); 이중으로 들어가고 있어서 ls_event 만 들어가게 
            connection.query(sql, params, function(err, rows, fields) {
                // if(connection) return connection.release();
                if (err) {
                    console.log("error:" + err);
                }



            });
            //if(connection) return connection.release();
            console.log("sqlplus : " + sqlplussub);
            if (sqlplussub) {
                connection.query(sqlplussub, "", function(err, rows, fields) {
                    if (err) console.log(err);

                    if (items == "batteryIn") { // 배터리 인을 하게 되면 충전 가격을 보내야 함
                        params = "";
                        var paymoneyv = 0; // 일단 테스트라 10원만
                        var payType = "";
                        var jsonPayType = new Object();
                        soc = soc / 10

                        //connection.query("select count(*) as qty from ls_charger where stationId='"+stationId+"' and openclose_yn='Y' and status = 'NORMAL' and chargingSequence in ('COMPLETE') " , "", function(err2, rows2, fields2){
                        //상태가 complete 가 아니더라도 soc가100인것도 결제금액을 보내도록 수정

                        connection.query("SELECT count(*) as qty  FROM   ls_charger  where batteryIO = 'I' and  stationId='" + stationId + "' and (chargingSequence = 'COMPLETE' and batSoc > '950')  ", "", function(err2, rows2, fields2) {
                            //이전소스 상단에 as qty추가 5.26일 17:26 아래주석은 원복데이터
                            //connection.query("select count(*) as qty from ls_charger where stationId='"+stationId+"' and openclose_yn = 'Y' and status = 'NORMAL' and (chargingSequence = 'COMPLETE' and batSoc > '950') " , "", function(err2, rows2, fields2){

                            if (err2) {
                                console.log("error:" + err2);
                            }

                            //if(rows2[0]['qty']>1 && soc<180){  // 뱃터리가 2개이상인경우만 열리게.. 1개면 안열리게.. 그리고 soc 가 160 이상이면 충전할 필요가 없기에 안열리게 
                            //if(rows2[0]['qty']>1){ // 뱃터리가 2개이상인경우만 열리게 김태현 소장이 말함 2022.05.26

                            if (rows2[0]['qty'] > 1 && soc < 190) { // 뱃터리가 2개이상인경우만 열리게 김태현 소장이 말함 그리고 soc 가 평균95 이상이면 충전할 필요가 없기에 안열리게  2022.06.20 

                                // 1-1 조건
                                // (SELECT sum(batSoc/10) AS soc FROM (SELECT * from ls_charger where  stationId='"+stationId+"' and openclose_yn='Y' and status = 'NORMAL' ORDER BY time DESC LIMIT 0,20 ) c where   stationId='"+stationId+"' and  (chargingSequence = 'COMPLETE' and batSoc > '950') order by open_dtm asc ,batSoc desc limit 0,2) << 200 대신 쓴 이유 - 지금 최고 높은 soc 밧데리가 만충이 아닐경우 그만큼 비용을 빼기 위해서 

                                // 10원단위에서 버림되도록 수정 2022.01.03
                                // 1-1 적용 2022.01.04
                                connection.query("SELECT FLOOR((((select sum(batSoc/10) as soc from (SELECT batSoc FROM (SELECT * from ls_charger where  stationId='" + stationId + "' and openclose_yn='Y'  and status = 'NORMAL' ORDER BY time DESC LIMIT 0,20 ) c where   stationId='" + stationId + "' and  (chargingSequence = 'COMPLETE' and batSoc > '950') order by open_dtm asc ,batSoc desc limit 0,2) d)-" + soc + ")*perPrice)/10)*10 as price, payType FROM ls_station where stationId='" + stationId + "' limit 0,1", "", function(err3, rows3, fields3) {
                                    if (err3) {
                                        console.log("error:" + err3);
                                    }
                                    console.log("soc:" + rows3[0]['price']);
                                    paymoneyv = rows3[0]['price']; // 0인경우 10원나오고 perprice 값이 있는경우 계산되게.... 
                                    payType = rows3[0]['payType'];
                                    if (paymoneyv < 1) paymoneyv = 10; //QR시 paymoney가 넘어간다고 해서 이부분 주석 22.03.28

                                    console.log("method:" + rows3[0]['payType']);
                                    //console.log(typeof rows3[0]['payType']);
                                    //QR시 paymoney가 넘어간다고 해서 if문 변경 22.03.28 ,변수로 빼서 비교 22.3.29
                                    if (payType == "2") {
                                        // qr 이 아닌 티머니인경우
                                        //callback(null, {result:"CONTROL", payMoney:paymoneyv});
                                        jsonPayType = {
                                            result: "CONTROL",
                                            payMoney: paymoneyv
                                        };

                                    } else {
                                        // qr 인경우
                                        http.get("http://except.otosone.co.kr/mooving.php?stationId=" + stationId);
                                        //callback(null, {result: "QR"});
                                        jsonPayType = {
                                            result: "QR"
                                        };
                                    }
                                    callback(null, jsonPayType); //의심되는 callback 빼기 22.7.12 


                                });
                            } else {
                                var rkey = Math.floor(Math.random() * (100000 - 1)) + 1;
                                sqlplussub = "insert into la_randomkey set stationId='" + stationId + "',keyv='" + rkey + "',reg_dtm=date_add(now(), interval 9 hour)";
                                connection.query(sqlplussub, "", function(err, rows, fields) {
                                    if (err) {
                                        console.log("error:" + err);
                                    }
                                    http.get("http://except.otosone.co.kr/setLock.php?sw=" + stationId + "&sj=" + rkey);
                                    callback(null, {
                                        result: "CONTROL",
                                        payMoney: -1,
                                        batteryInfo: batteryInfov
                                    });

                                    // 180 초과인경우
                                });
                                //callback(null, {result:"CONTROL",payResult: event['payResult']['result']});

                            }

                        });


                    } else if (items == "payResult") { // 충전가격이 다 충전되면 베터리를 언락해야함	   // order by open_dtm asc 강제오픈시간이 제일 제일 나중인것부터 오픈
                        if (event['payResult']['result'] == "OK") {
                            connection.query("SELECT id, if(locks='true','UNLOCK','UNLOCK') as status FROM   ls_charger  where batteryIO = 'I' and  stationId='" + stationId + "' and (chargingSequence = 'COMPLETE' and batSoc > '950') order by open_dtm asc ,batSoc desc limit 0,2", params, function(err2, rows2, fields2) {
                                if (err2) {
                                    console.log("error:" + err2);
                                }
                                console.log("rows:" + JSON.stringify(rows2));
                                rows2.forEach(function(key, val) {
                                    connection.query("update ls_charger set locks = 'false' where id='" + key['id'] + "' and stationId='" + stationId + "'; insert into ls_status set ent_dtm = date_add(now(), interval 9 hour), typev='payR', jsonv='" + JSON.stringify(rows2) + "' , stationId='" + stationId + "';  ", params, function(err3, rows3, fields3) {
                                        if (err3) {
                                            console.log("error:" + err3);
                                        }
                                    });
                                    //console.log("update ls_charger set locks = 'false' where id='"+key['id']+"' and stationId='"+stationId+"';insert into ls_status set ent_dtm = date_add(now(), interval 9 hour), typev='payR', jsonv='"+JSON.stringify(rows2)+"' , stationId='"+stationId+"';"); 
                                });


                                callback(null, {
                                    result: "CONTROL",
                                    setLock: rows2
                                });

                            });
                        }



                    } else {
                        callback(null, {
                            result: "OK"
                        });

                    }

                });

            } else {
                callback(null, {
                    result: "OK"
                });

            }
            if (connection) connection.release();

        }




        if (notype == "0"){ 
        	callback(null, {
            	result: "wrong type"
    		});
			if (connection) connection.release(); //DB CLOSE 추가
		}
        //});
    });



};