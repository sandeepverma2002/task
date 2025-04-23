// db.js
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DB_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 200000, // Timeout for acquiring a connection
  ssl: {
    rejectUnauthorized: false,
  },
});

module.exports = pool;
