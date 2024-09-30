import * as aws from "@pulumi/aws";

export const sampleDataDB = new aws.rds.Instance("sample-data-postgre-sql", {
  allocatedStorage: 10,
  dbName: "sampleDataPostGreSQL",
  engine: "postgres",
  engineVersion: "16.3",
  instanceClass: aws.rds.InstanceType.T4G_Micro,
  username: "foo",
  password: "foobarbaz",
  parameterGroupName: "default.postgres16",
  skipFinalSnapshot: true,
  publiclyAccessible: true,
  port: 5432,
});
