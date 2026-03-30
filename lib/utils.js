/**
 * lib/utils.js — Shared utility functions
 */

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names safely.
 * Combines clsx (conditional classes) with tailwind-merge (deduplication).
 *
 * @param {...(string|undefined|null|boolean|Object)} inputs
 * @returns {string}
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a random ID (crypto-safe, no external dep needed in modern Node/browsers).
 *
 * @param {number} [length=8]
 * @returns {string}
 */
export function generateId(length = 8) {
  return crypto.randomUUID().replace(/-/g, "").slice(0, length);
}

/**
 * Format a date relative to now (e.g. "2 minutes ago").
 *
 * @param {Date|string|number} date
 * @returns {string}
 */
export function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) {
    return "just now";
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return new Date(date).toLocaleDateString();
}

/**
 * Truncate a string to a max length, adding an ellipsis.
 *
 * @param {string} str
 * @param {number} max
 * @returns {string}
 */
export function truncate(str, max) {
  if (str.length <= max) {
    return str;
  }
  return str.slice(0, max - 1) + "…";
}

/**
 * Sleep for a given number of milliseconds. Useful in retry logic.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
