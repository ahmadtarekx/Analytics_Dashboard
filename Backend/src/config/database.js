const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || 'samka1234',
    database: process.env.DB_NAME || 'mydb',
};

/**
 * Creates a new MySQL connection.
 * Usage: const connection = await getConnection();
 *        // ... queries ...
 *        await connection.end();
 */
async function getConnection() {
    return mysql.createConnection(dbConfig);
}

module.exports = { getConnection, dbConfig };
