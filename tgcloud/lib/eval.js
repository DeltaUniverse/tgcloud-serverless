/**
 * @fileoverview Evaluator and serializer utilities for JavaScript execution handler.
 */

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

/**
 * Serializes any JavaScript value into a clean string representation formatted for preview.
 * Handles circular references, BigInt, Errors, Sets, Maps, Uint8Arrays, Symbols, Functions,
 * strings, and null/undefined values safely without losing diagnostics.
 *
 * @param {unknown} value - Value to serialize
 * @returns {string} Serialized string representation
 */
export function serialize(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value === "string") return value || "\u2060";
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "function") {
    return `[Function: ${value.name || "anonymous"}]`;
  }

  const seen = new WeakSet();

  try {
    return JSON.stringify(
      value,
      (_key, val) => {
        if (typeof val === "object" && val !== null) {
          if (seen.has(val)) return "[Circular]";
          seen.add(val);

          if (val instanceof Error) {
            return {
              name: val.name,
              message: val.message,
              stack: val.stack,
            };
          }

          if (val instanceof Set) return Array.from(val);
          if (val instanceof Map) return Object.fromEntries(val);
          if (val instanceof Uint8Array) return `[Uint8Array(${val.length})]`;
        }

        if (typeof val === "bigint") return `${val}n`;
        if (typeof val === "function") {
          return `[Function: ${val.name || "anonymous"}]`;
        }
        if (typeof val === "symbol") return val.toString();

        return val;
      },
      1,
    );
  } catch (error) {
    return String(value ?? error);
  }
}

/**
 * Evaluates arbitrary asynchronous JavaScript code within a provided scope.
 *
 * @param {string} code - JavaScript code string to execute
 * @param {Record<string, unknown>} scope - Execution scope variables
 * @returns {Promise<unknown>} Evaluation result
 */
export function evaluateCode(code, scope) {
  const fn = new AsyncFunction(...Object.keys(scope), code);
  return fn(...Object.values(scope));
}
