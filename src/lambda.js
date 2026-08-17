import pino from "pino";
import {randomBytes} from "node:crypto";

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
let traceFlags = "00"; // 2 hex digits

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
      return {level: label.toUpperCase()};
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

function newSpanId() {
  let id;

  do {
    id = randomBytes(8).toString("hex");
  } while (id === "0000000000000000");

  return id;
}

logger.addContext = function (event, ctx) {
  traceFlags = "00"; // reset
  const headers = Object.fromEntries(
    Object.entries(event?.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v,])
  );

  // W3C traceparent header
  // <version>-<trace-id>-<parent-id>-<trace-flags>
  // example: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
  const traceparent = headers["traceparent"];

  let traceId; // 32 hex digits

  if (traceparent) {
    const parts = traceparent.split("-");
    if (
      parts.length === 4 &&
      parts[0] === "00" &&
      /^[0-9a-f]{32}$/.test(parts[1]) && parts[1] !== "00000000000000000000000000000000" &&
      /^[0-9a-f]{16}$/.test(parts[2]) && parts[2] !== "0000000000000000" &&
      /^[0-9a-f]{2}$/.test(parts[3])
    ) {
      traceId = parts[1];
      traceFlags = parts[3];
    }
  }

  traceId ??= randomBytes(16).toString("hex");
  const spanId = newSpanId();

  context = {
    traceId,
    spanId,

    module: "lambda",

    // AWS Lambda request ID
    requestId: ctx.awsRequestId,

    // API Gateway request ID (if applicable)
    agwRequestId: event?.requestContext?.requestId,

    // API Gateway endpoint in format {HTTP_METHOD}{RESOURCE_PATH}, e.g. GET/hello
    endpoint: event?.httpMethod && event?.resource ? `${event.httpMethod}${event.resource}` : undefined,
  }
}

logger.newTraceparent = function () {
  return `00-${context.traceId}-${newSpanId()}-${traceFlags}`;
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

  const logger2 = logger.child({module: "service"});
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
