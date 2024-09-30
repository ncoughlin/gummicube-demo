import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const config = new pulumi.Config();

// these values should be moved to a secret manager
const db_username = config.require("db_username");
const db_password = config.require("db_password");

export const sampleDataDB = new aws.rds.Instance("sample-data-postgre-sql", {
  allocatedStorage: 10,
  dbName: "sampleDataPostGreSQL",
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
