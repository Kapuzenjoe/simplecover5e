import { MODULE_ID } from "./config.mjs";

/* -------------------------------------------- */
/*  Logging                                     */
/* -------------------------------------------- */

/**
 * Log a console message with the module id prefix.
 * @param {string} message                 Message to display.
 * @param {object} [options={}]
 * @param {any[]} [options.extras=[]]      Extra arguments passed to the logging method.
 * @param {string} [options.level="warn"]  Console logging method to call.
 */
export function log(message, { extras=[], level="warn" }={}) {
  console[level](`[${MODULE_ID}] ${message}`, ...extras);
}
