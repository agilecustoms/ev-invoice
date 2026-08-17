import pino from "pino";

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: "America/New_York", // if not specify, it uses UTC
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
  hour12: false,
})

let context = {};

const logger = pino({
  level: (process.env.AWS_LAMBDA_LOG_LEVEL ?? "INFO").toLowerCase(),

  mixin() {
    return { ...context };
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
});

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

  logger.info("Lambda invoked4");

  const logger2 = logger.child({ component: "service" });
  logger2.warn("child warning");

  try {
    outer();
  } catch (err) {
    logger2.error(err, "Error occurred");
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Hello, world 3!",
    }),
  };
};
