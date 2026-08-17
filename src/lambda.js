import {logger} from "./logger-wrapper.js";
import {outer} from "./service.js";

export const handler = async (event, context) => {
  logger.addContext(event, context);

  logger.info("Lambda invoked48")

  const logger2 = logger.child({module: "lambda2"});
  logger2.warn("child warning");

  try {
    outer();
  } catch (err) {
    logger2.error(err, "Error occurred");
  }

  // await new Promise((resolve) => { destination.flush(resolve)});

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Hello, world 49!",
    }),
  };
};
