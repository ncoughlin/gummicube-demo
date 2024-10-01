import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { sampleDataDB } from "../../databases/sampleDataPostGreSQL";

// Initialize the Pulumi config (to retrieve variables)
const config = new pulumi.Config();

// Retrieve the database variables
// ** these values should be moved to a secret manager
const db_username = config.require("db_username");
const db_password = config.require("db_password");
const db_name = config.require("db_name");

// Create an IAM role for the Lambda function
const lambdaRole = new aws.iam.Role("lambdaRole", {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: "lambda.amazonaws.com",
  }),
});

// Attach the necessary policies to the role
new aws.iam.RolePolicyAttachment("lambdaRolePolicyAttachment", {
  role: lambdaRole.name,
  policyArn: aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole,
});
new aws.iam.RolePolicyAttachment("lambdaRoleVPCAccessPolicyAttachment", {
  role: lambdaRole.name,
  policyArn: aws.iam.ManagedPolicies.AWSLambdaVPCAccessExecutionRole,
});

// Define the RDS instance ID
const dbInstanceId = sampleDataDB.id;

// Fetch the RDS database instance details
const dbInstance = dbInstanceId.apply((id) =>
  aws.rds.getInstance({
    dbInstanceIdentifier: id,
  })
);

// Extract the DB subnet group name
const dbSubnetGroupName = dbInstance.apply(
  (instance) => instance.dbSubnetGroup
);

// Fetch the subnet IDs from the DB subnet group
const dbSubnetGroup = dbSubnetGroupName.apply((name) =>
  aws.rds.getSubnetGroup({
    name: name,
  })
);

const subnetIds = dbSubnetGroup.apply((group) => group.subnetIds);

// Create the Lambda function
export const getSampleData = new aws.lambda.Function("getSampleData", {
  runtime: aws.lambda.Runtime.NodeJS18dX,
  code: new pulumi.asset.AssetArchive({
    ".": new pulumi.asset.FileArchive("./lambdas/get-sample-data"), // Path to lambda index file
  }),
  handler: "index.handler",
  role: lambdaRole.arn,
  environment: {
    variables: {
      DB_HOST: sampleDataDB.endpoint.apply((e) => e.split(":")[0]),
      DB_USER: db_username,
      DB_PASS: db_password,
      DB_NAME: db_name,
    },
  },
  vpcConfig: {
    subnetIds: subnetIds,
    securityGroupIds: dbInstance.apply((instance) =>
      instance.vpcSecurityGroups.map((sg) => sg)
    ),
  },
});
