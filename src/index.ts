import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { getSampleData } from "./lambdas/get-sample-data/generate";
import { sampleDataDB } from "./databases/sampleDataPostGreSQL";

// Get the current stack name
const stackName = pulumi.getStack();

// Create the API
const restApi = new aws.apigateway.RestApi("api", {
  name: "api",
});

// Create the Resource
const sampleDataResource = new aws.apigateway.Resource("sampleDataResource", {
  restApi: restApi.id,
  parentId: restApi.rootResourceId,
  pathPart: "sample-data",
});

// Create the GET Method
const getMethod = new aws.apigateway.Method("getSampleDataMethod", {
  restApi: restApi.id,
  resourceId: sampleDataResource.id,
  httpMethod: "GET",
  authorization: "NONE",
});

// Create the Lambda Integration with AWS type
const lambdaIntegration = new aws.apigateway.Integration("getSampleDataIntegration", {
  restApi: restApi.id,
  resourceId: sampleDataResource.id,
  httpMethod: getMethod.httpMethod,
  type: "AWS",
  integrationHttpMethod: "POST",
  uri: getSampleData.invokeArn,
  passthroughBehavior: "WHEN_NO_MATCH",
  requestTemplates: {
    "application/json": JSON.stringify({
      statusCode: 200,
    }),
  },
});

// Grant API Gateway permission to invoke the Lambda
const invokePermission = new aws.lambda.Permission("apiGatewayInvokePermission", {
  action: "lambda:InvokeFunction",
  function: getSampleData.name,
  principal: "apigateway.amazonaws.com",
  sourceArn: pulumi.interpolate`${restApi.executionArn}/*/*`,
});

// Define Method Responses
const getMethodResponse = new aws.apigateway.MethodResponse("getMethodResponse", {
  restApi: restApi.id,
  resourceId: sampleDataResource.id,
  httpMethod: getMethod.httpMethod,
  statusCode: "200",
  responseModels: {
    "application/json": "Empty",
  },
  responseParameters: {
    "method.response.header.Access-Control-Allow-Origin": true,
    "method.response.header.Access-Control-Allow-Headers": true,
    "method.response.header.Access-Control-Allow-Methods": true,
  },
});

// Define Integration Responses
const getIntegrationResponse = new aws.apigateway.IntegrationResponse("getIntegrationResponse", {
  restApi: restApi.id,
  resourceId: sampleDataResource.id,
  httpMethod: getMethod.httpMethod,
  statusCode: getMethodResponse.statusCode,
  responseTemplates: {
    "application/json": "",
  },

  // 😡 these response headers are simply not showing up in the responses despite documentation
  // https://www.pulumi.com/registry/packages/aws/api-docs/apigateway/integrationresponse/
  // however manually inserting the headers into the response in Lambda works...
  // we shouldn't have to do this, but it's a workaround for now

  responseParameters: {
    "method.response.header.Access-Control-Allow-Origin": "'*'",
    "method.response.header.Access-Control-Allow-Headers": "'Content-Type'",
    "method.response.header.Access-Control-Allow-Methods": "'GET,OPTIONS'",
  },
});

// Add an OPTIONS Method for Preflight Requests
const optionsMethod = new aws.apigateway.Method("optionsMethod", {
  restApi: restApi.id,
  resourceId: sampleDataResource.id,
  httpMethod: "OPTIONS",
  authorization: "NONE",
});

const optionsIntegration = new aws.apigateway.Integration("optionsIntegration", {
  restApi: restApi.id,
  resourceId: sampleDataResource.id,
  httpMethod: optionsMethod.httpMethod,
  type: "MOCK",
  requestTemplates: {
    "application/json": '{"statusCode": 200}',
  },
});

const optionsMethodResponse = new aws.apigateway.MethodResponse("optionsMethodResponse", {
  restApi: restApi.id,
  resourceId: sampleDataResource.id,
  httpMethod: optionsMethod.httpMethod,
  statusCode: "200",
  responseParameters: {
    "method.response.header.Access-Control-Allow-Origin": true,
    "method.response.header.Access-Control-Allow-Headers": true,
    "method.response.header.Access-Control-Allow-Methods": true,
  },
});

const optionsIntegrationResponse = new aws.apigateway.IntegrationResponse("optionsIntegrationResponse", {
  restApi: restApi.id,
  resourceId: sampleDataResource.id,
  httpMethod: optionsMethod.httpMethod,
  statusCode: optionsMethodResponse.statusCode,
  responseParameters: {
    "method.response.header.Access-Control-Allow-Origin": "'*'",
    "method.response.header.Access-Control-Allow-Headers": "'Content-Type'",
    "method.response.header.Access-Control-Allow-Methods": "'GET,OPTIONS'",
  },
});

// Deploy the API
const deployment = new aws.apigateway.Deployment("apiDeployment", {
  restApi: restApi.id,
  triggers: {
    redeployment: pulumi.concat(getMethod.id, optionsMethod.id),
  },
});

// Create a Stage
const stage = new aws.apigateway.Stage("apiStage", {
  restApi: restApi.id,
  deployment: deployment.id,
  stageName: stackName,
});

// Export the Invoke URL
export const url = pulumi.interpolate`${deployment.invokeUrl}${stage.stageName}/`;
export const dbEndpoint = sampleDataDB.endpoint;
