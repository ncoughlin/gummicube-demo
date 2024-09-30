import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const config = new pulumi.Config();

// these values should be moved to a secret manager
const db_username = config.require("db_username");
const db_password = config.require("db_password");
const db_name = config.require("db_name");

export const sampleDataDB = new aws.rds.Instance("sample-data-postgre-sql", {
  allocatedStorage: 10,
  dbName: db_name,
  engine: "postgres",
  engineVersion: "16.3",
  instanceClass: aws.rds.InstanceType.T4G_Micro,
  username: db_username,
  password: db_password,
  parameterGroupName: "default.postgres16",
  skipFinalSnapshot: true,
  publiclyAccessible: true,
  port: 5432,
});

type eventType = {
  dbEndpoint: string;
};

// Create a schema and a table using a Lambda function
const createSchemaAndTable = new aws.lambda.CallbackFunction(
  "createSchemaAndTable",
  {
    callback: async (event: eventType, context) => {
      const { Client } = require("pg");
      const client = new Client({
        host: event.dbEndpoint,
        database: db_name,
        user: db_username,
        password: db_password,
      });

      await client.connect();
      await client.query(`CREATE SCHEMA IF NOT EXISTS myschema`);
      await client.query(
        `CREATE TABLE IF NOT EXISTS sample_data_schema.sample_data_table (id SERIAL PRIMARY KEY, data VARCHAR(100))`
      );
      await client.end();
    },
  }
);

// Invoke the Lambda function to create the schema and table
const invokeCreateSchemaAndTable = new aws.lambda.Permission(
  "invokeCreateSchemaAndTable",
  {
    action: "lambda:InvokeFunction",
    function: createSchemaAndTable.name,
    principal: "rds.amazonaws.com",
    sourceArn: sampleDataDB.arn,
  }
);

const rdsInvoke = new aws.rds.EventSubscription(
  "rdsInvoke",
  {
    snsTopic: createSchemaAndTable.arn,
    sourceType: "db-instance",
    sourceIds: [sampleDataDB.id],
    eventCategories: ["creation"],
  },
  { dependsOn: [sampleDataDB, invokeCreateSchemaAndTable] }
);
