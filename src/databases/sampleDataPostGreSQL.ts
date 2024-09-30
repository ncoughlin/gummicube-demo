import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Client } from "pg";

// just use plaintext username and password for now
// in a real-world scenario, you would use a secret manager
const dbUsername = "ncoughlin";
const dbPassword = "ncoughlin";

// the ip addresses of the developers on this project
// ⚠ if you do not add yourself to this list, you will not be able to access the RDS instance
// cannot be fetched asynchronously as pulumi does not support async initialization
const authorizedIpAddresses = ["69.9.132.237/32"];

// Create a security group that allows inbound access to the RDS instance
// const rdsSecurityGroup = new aws.ec2.SecurityGroup("rdsSecurityGroup", {
//   description: "Allow PostgreSQL access from my IP",
//   ingress: [
//     {
//       protocol: "tcp",
//       fromPort: 5432,
//       toPort: 5432,
//       cidrBlocks: authorizedIpAddresses,
//     },
//   ],
//   egress: [
//     {
//       protocol: "-1", // All protocols
//       fromPort: 0,
//       toPort: 0,
//       cidrBlocks: ["0.0.0.0/0"],
//     },
//   ],
// });

// temp fully open security group for testing
const rdsSecurityGroup = new aws.ec2.SecurityGroup("rdsSecurityGroup", {
    description: "Allow PostgreSQL access from anywhere (temporary for testing)",
    ingress: [
      {
        protocol: "tcp",
        fromPort: 5432,
        toPort: 5432,
        cidrBlocks: ["0.0.0.0/0"],
      },
    ],
    egress: [
      {
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ["0.0.0.0/0"],
      },
    ],
  });

// 1. Provision the AWS RDS PostgreSQL Instance
export const sampleDataDB = new aws.rds.Instance("sample-data-postgre-sql", {
  allocatedStorage: 10,
  dbName: "sampledatapostgresql",
  engine: "postgres",
  engineVersion: "16.3",
  instanceClass: aws.rds.InstanceType.T4G_Micro,
  username: dbUsername,
  password: dbPassword,
  skipFinalSnapshot: true,
  publiclyAccessible: true, // Ensure the DB is accessible from your network
  port: 5432,
  vpcSecurityGroupIds: [rdsSecurityGroup.id],
});



// 2. Define the SQL Commands to Create Schema and Table
const sqlCommands = `
CREATE SCHEMA IF NOT EXISTS myschema;

CREATE TABLE IF NOT EXISTS myschema.daily_metrics (
    date DATE PRIMARY KEY,
    sales NUMERIC(12,2) NOT NULL CHECK (sales >= 0),
    cost NUMERIC(12,2) NOT NULL CHECK (cost >= 0),
    clicks INTEGER NOT NULL CHECK (clicks >= 0)
);
`;

// Define a ComponentResource to initialize the database
class PostgresDatabaseInit extends pulumi.ComponentResource {
    constructor(
      name: string,
      args: {
        dbInstance: aws.rds.Instance;
        user: pulumi.Input<string>;
        password: pulumi.Input<string>;
        sqlCommands: pulumi.Input<string>;
      },
      opts?: pulumi.ComponentResourceOptions
    ) {
      super("custom:resource:PostgresDatabaseInit", name, args, opts);
  
      pulumi
        .all([
          args.dbInstance.address,
          args.dbInstance.port,
          args.dbInstance.dbName,
          args.user,
          args.password,
          args.sqlCommands,
        ])
        .apply(
          async ([address, port, dbName, user, password, sqlCommands]) => {
            // Wait until the database accepts connections
            const maxAttempts = 60;
            let connected = false;
            let attempt = 0;

            console.log("dbName", dbName);
            console.log("address", address);
            console.log("port", port);
            
            while (!connected && attempt < maxAttempts) {
              try {
                console.log("Connecting to database:", address, port);
                const client = new Client({
                  host: address,
                  port: port,
                  user: user,
                  password: password,
                  database: dbName,
                });
                await client.connect();
                await client.end();
                connected = true;
              } catch (err) {
                console.log(
                  `Waiting for database to be ready... Attempt ${
                    attempt + 1
                  }/${maxAttempts}`
                );
                await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
                attempt++;
              }
            }
  
            if (!connected) {
              throw new Error(
                "Unable to connect to the database after multiple attempts."
              );
            }
  
            // Connect and run the SQL commands
            const client = new Client({
              host: address,
              port: port,
              user: user,
              password: password,
              database: dbName,
            });
            await client.connect();
            try {
              await client.query(sqlCommands);
              console.log("SQL commands executed successfully.");
            } catch (error) {
              console.error("Error executing SQL commands:", error);
              throw error;
            } finally {
              await client.end();
            }
          }
        );
    }
  }
  
  // Instantiate the ComponentResource
  const initDb = new PostgresDatabaseInit(
    "initDb",
    {
      dbInstance: sampleDataDB,
      user: dbUsername,
      password: dbPassword,
      sqlCommands: sqlCommands,
    },
    { dependsOn: sampleDataDB }
  );
