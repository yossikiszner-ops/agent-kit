/**
 * bricks/tools/calculator.js — Math & unit conversion
 *
 * No API key required. Uses a safe expression evaluator.
 * Supports: arithmetic, percentages, exponents, basic unit conversion.
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";

const brick = {
  name: "calculator",
  description:
    "Evaluate mathematical expressions and perform unit conversions. " +
    "Use this for any arithmetic, percentage calculations, or unit conversions " +
    "rather than computing mentally. Examples: '15% of 340', '(12 + 8) * 3', '5 miles to km'.",

  parameters: z.object({
    expression: z
      .string()
      .describe(
        "The math expression to evaluate, e.g. '15% of 340' or '(12 + 8) * 3 / 2'"
      ),
  }),

  execute: async ({ expression }) => {
    // Sanitise — only allow safe math characters
    const safe = expression
      .toLowerCase()
      .replace(/[^0-9+\-*/().%\s^a-z]/g, "");

    // Handle unit conversions
    const conversion = tryConversion(safe);
    if (conversion !== null) {
      return { result: conversion, expression };
    }

    // Handle percentage shorthand: "15% of 340"
    const pctMatch = safe.match(
      /^([\d.]+)%\s+of\s+([\d.]+)$/
    );
    if (pctMatch) {
      const result = (parseFloat(pctMatch[1]) / 100) * parseFloat(pctMatch[2]);
      return { result: round(result), expression };
    }

    // Evaluate the expression safely
    try {
      // Replace ^ with ** for exponents
      const expr = safe.replace(/\^/g, "**");
      // Use Function constructor to evaluate — safe because we sanitised above
      // eslint-disable-next-line no-new-func
      const result = new Function(`"use strict"; return (${expr})`)();
      if (typeof result !== "number" || !isFinite(result)) {
        return { error: "Expression did not produce a valid number." };
      }
      return { result: round(result), expression };
    } catch {
      return {
        error: `Could not evaluate "${expression}". Try a simpler expression.`,
      };
    }
  },

  onError: (err) =>
    `The calculator encountered an error: ${err.message}. Try rephrasing the expression.`,
};

// ─── Unit conversion helper ───────────────────────────────────────────────────
const CONVERSIONS = {
  // Length
  "miles to km": (v) => v * 1.60934,
  "km to miles": (v) => v / 1.60934,
  "feet to meters": (v) => v * 0.3048,
  "meters to feet": (v) => v / 0.3048,
  "inches to cm": (v) => v * 2.54,
  "cm to inches": (v) => v / 2.54,
  // Weight
  "kg to lbs": (v) => v * 2.20462,
  "lbs to kg": (v) => v / 2.20462,
  "grams to oz": (v) => v * 0.035274,
  "oz to grams": (v) => v / 0.035274,
  // Temperature
  "celsius to fahrenheit": (v) => (v * 9) / 5 + 32,
  "fahrenheit to celsius": (v) => ((v - 32) * 5) / 9,
  // Volume
  "liters to gallons": (v) => v * 0.264172,
  "gallons to liters": (v) => v / 0.264172,
};

/**
 * @param {string} expr
 * @returns {string | null}
 */
function tryConversion(expr) {
  for (const [pattern, fn] of Object.entries(CONVERSIONS)) {
    const re = new RegExp(`^([\\d.]+)\\s+${pattern.replace(/ /g, "\\s+")}$`);
    const match = expr.match(re);
    if (match) {
      const result = round(fn(parseFloat(match[1])));
      return `${match[1]} ${pattern.split(" to ")[0]} = ${result} ${pattern.split(" to ")[1]}`;
    }
  }
  return null;
}

/** @param {number} n */
function round(n) {
  return Math.round(n * 1e10) / 1e10;
}

export default brick;
