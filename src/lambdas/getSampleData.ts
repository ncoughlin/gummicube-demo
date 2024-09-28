import * as aws from "@pulumi/aws";

export const getSampleData = new aws.lambda.CallbackFunction("f", {
    callback: async (ev, ctx) => {
      // fetch data from RDS database
      const data = [
        { name: "Alice", age: 30 },
        { name: "Bob", age: 35 },
        { name: "Charlie", age: 40 },
      ];
  
      return {
        statusCode: 200,
        body: { data: data },
      };
    },
  });