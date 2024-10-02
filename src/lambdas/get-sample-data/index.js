const { Client } = require("pg");

exports.handler = async (event, context) => {
  console.log("🌎 event", event);

  // standardized error handler
  const handleError = (error) => {
    console.error("⚠ Full Error Code", JSON.stringify(error));

    const errorResponse = {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
      },
      message: error.message,
      requestId: context.awsRequestId,
      function_name: process.env.AWS_LAMBDA_FUNCTION_NAME,
      function_version: process.env.AWS_LAMBDA_FUNCTION_VERSION,
    };

    console.log("🚧 Custom Error Response", errorResponse);

    // must throw error response in actual error for API Gateway to recognize
    // and handle it properly
    throw new Error(JSON.stringify(errorResponse));
  };

  async function connectToDatabase(client) {
    try {
      await client.connect();
    } catch (error) {
      handleError(error);
    }
  }

  // 📝: i've confirmed that the environment variables are being passed in correctly

  const client = new Client({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: {
      rejectUnauthorized: false, // For self-signed certificates
    },
  });

  await connectToDatabase(client);

  try {
    const res = await client.query(`
      SELECT * FROM "advertising-data".daily
      ORDER BY date ASC 
    `);

    console.log("res", res);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
      },
      body: JSON.stringify(res.rows),
    };
  } catch (error) {
    handleError(error);
  } finally {
    await client.end();
  }
};
