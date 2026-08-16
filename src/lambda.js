import pino from "pino";

const log = pino();

export const handler = async (event, context) => {
  log.info({event}, "Lambda invoked");
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Hello, world!",
    }),
  };
};
