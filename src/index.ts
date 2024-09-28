import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as apigateway from "@pulumi/aws-apigateway";
import { getSampleData } from "./lambdas/getSampleData";

const api = new apigateway.RestAPI("api", {
  routes: [
    {
      path: "/sample-data",
      method: "GET",
      eventHandler: getSampleData,
    },
  ],
});

export const url = api.url;
