const mysql = require("mysql");
// const mysql = require('mysql2/promise');
const config = require('./config.json');


let dbConfig = {
    host: config.npd.host,
    user: config.npd.user,
    password: config.npd.password,
    database: config.npd.database,
    connectionLimit: 500,
    multipleStatements: true
};
let createResponse = (status, body) => ({
    statusCode: status,
    body: (body)
});
const pool = mysql.createPool(dbConfig);
const connection = () => {
  return new Promise((resolve, reject) => {
  pool.getConnection((err, connection) => {
      if (err !== null) reject(createResponse(500, {
        message: err
    }));
   
    const query = (sql, binding) => {
      return new Promise((resolve, reject) => {
         connection.query(sql, binding, (err, result) => {
           if (err) reject(err);
           resolve(result);
           });
         });
       };
       const release = () => {
         return new Promise((resolve, reject) => {
           if (err) reject(err);
           console.log("MySQL pool released: threadId " + connection.threadId);
           resolve(connection.release());
         });
       };
       resolve({ query, release });
     });
   });
 };
const query = (sql, binding) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, binding, (err, result, fields) => {
      if (err) reject(err);
      resolve(result);
    });
  });
};
module.exports = { pool, connection, query };