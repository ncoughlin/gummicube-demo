const { Client } = require('pg');

exports.handler = async (event) => {
    const client = new Client({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
    });

    await client.connect();

    try {
        const res = await client.query('SELECT * FROM mytable'); // Replace with your query
        return {
            statusCode: 200,
            body: JSON.stringify(res.rows),
        };
    } finally {
        await client.end();
    }
};
