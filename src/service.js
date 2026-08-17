import {logger} from "./logger-wrapper.js";

const log = logger.child({module: "service"});

function inner() {
  log.info('before error')
  throw new Error("test error");
}

export function outer() {
  inner()
}
