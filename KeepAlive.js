// keepalive.js
const pool = require('./db');

// Function to keep DB connection alive by sending a query periodically
function keepAlive() {
  setInterval(
    async () => {
      try {
        await pool.query('SELECT 1');
        console.log('DB connection kept alive');
      } catch (err) {
        console.error('Error keeping DB connection alive:', err);
      }
    },
    5 * 60 * 1000
  ); // Every 5 minutes
}

module.exports = keepAlive;
