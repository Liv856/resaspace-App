const mysql = require('mysql');
const util = require('util');

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "resaspace"
});
const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});
pool.query = util.promisify(pool.query);
db.connect((err) => {
  if (err) throw err;
  console.log('Connexion MySQL réussie');
});
pool.query = util.promisify(pool.query);
module.exports = db;