import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as apigateway from "@pulumi/aws-apigateway";
import { getSampleData } from "./lambdas/get-sample-data/generate";
import { sampleDataDB } from "./databases/sampleDataPostGreSQL";

const api = new apigateway.RestAPI("api", {
  routes: [
    {
      path: "/sample-data",
      method: "GET",
      eventHandler: getSampleData,
    },
  ],
});

// exports
export const url = api.url;
export const dbEndpoint = sampleDataDB.endpoint;
