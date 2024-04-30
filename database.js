const mysql = require('mysql2');

// Create a connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',  // Replace with your MySQL username
  password: 'Teamglass1236',  // Replace with your MySQL password
  database: 'blog_platform',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Export the pool for use in other parts of your app
module.exports = pool.promise();
