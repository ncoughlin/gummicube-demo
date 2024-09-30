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
                `CREATE TABLE IF NOT EXISTS myschema.mytable (id SERIAL PRIMARY KEY, data VARCHAR(100))`
            );
            await client.end();
        },
    }
);

// Create an SNS Topic
const snsTopic = new aws.sns.Topic("rdsEventTopic");

// Subscribe the Lambda function to the SNS Topic
const snsSubscription = new aws.sns.TopicSubscription("snsSubscription", {
    topic: snsTopic.arn,
    protocol: "lambda",
    endpoint: createSchemaAndTable.arn,
});

// Grant SNS permission to invoke the Lambda function
const lambdaPermission = new aws.lambda.Permission("lambdaPermission", {
    action: "lambda:InvokeFunction",
    function: createSchemaAndTable.name,
    principal: "sns.amazonaws.com",
    sourceArn: snsTopic.arn,
});

// Create an RDS Event Subscription
const rdsInvoke = new aws.rds.EventSubscription(
    "rdsInvoke",
    {
        snsTopic: snsTopic.arn,
        sourceType: "db-instance",
        // sourceIds: [sampleDataDB.id],
        sourceIds: [sampleDataDB.identifier],
        eventCategories: ["creation"],
    },
    { dependsOn: [sampleDataDB, snsSubscription, lambdaPermission] }
);

// Export the database endpoint
export const dbEndpoint = sampleDataDB.endpoint;
