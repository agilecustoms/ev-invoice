import pino from "pino";

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: "America/New_York", // if not specify, it uses UTC
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
  hour12: false,
})

const destination = pino.destination({
  dest: 1,    // stdout
  sync: true, // default is false causing lots of logs are LOST! If use async, then do this at the end of the lambda handler:
  // destination.flushSync() or await new Promise((resolve) => { destination.flush(resolve)})
});

let context = {};

const logger = pino({
  // respect the log level set in AWS Lambda environment variable, default to INFO if not set
  level: (process.env.AWS_LAMBDA_LOG_LEVEL ?? "INFO").toLowerCase(),

  mixin(_, __, logger) {
    return {
      ...context,
      ...logger.bindings(), // prioritize bindings over mixin context, particularly to override 'module' in .child logger
    };
  },

  formatters: {
    level(label) {
      return { level: label.toUpperCase() };
    },
    log(object) {
      return {
        ...object,
        ftime: formatter.format(Date.now()),
      };
    },
  },
  messageKey: "message",
  errorKey: "error",
  base: {
    lambda: process.env.AWS_LAMBDA_FUNCTION_NAME,
  },
}, destination);

logger.silly = function (...args) {
  return this.trace(...args);
};

logger.addContext = function (event, ctx) {
  // ideally create new logger with .child({...}) method, but we already have a big code base where logger is imported
  context = {
    module: 'lambda',
    // AWS Lambda request ID
    requestId: ctx.awsRequestId,
    // API Gateway request ID (if applicable)
    agwRequestId: event?.requestContext?.requestId,
    // API Gateway endpoint in format {HTTP_METHOD}{RESOURCE_PATH}, e.g. GET/hello
    endpoint: event?.httpMethod && event?.resource ? `${event.httpMethod}${event.resource}` : undefined,
  }
}

function inner() {
  throw new Error("test error");
}

function outer() {
  inner()
}

export const handler = async (event, context) => {
  logger.addContext(event, context);

  logger.info("Lambda invoked48")

  const logger2 = logger.child({ module: "service" });
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
