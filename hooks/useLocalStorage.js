"use client";

/**
 * hooks/useLocalStorage.js — Persist state in localStorage
 *
 * Handles SSR safely (localStorage is undefined on the server).
 * Falls back gracefully if localStorage is unavailable.
 */

import { useState, useEffect, useCallback } from "react";

/**
 * Like useState but backed by localStorage.
 * Safe for use in Next.js Server Component trees — returns the
 * initialValue on first render (server), then syncs with storage.
 *
 * @template T
 * @param {string} key           - localStorage key
 * @param {T}      initialValue  - default value if key doesn't exist
 * @returns {[T, (value: T | ((prev: T) => T)) => void, () => void]}
 *           [value, setValue, clearValue]
 */
export function useLocalStorage(key, initialValue) {
  // Always start with initialValue — avoids SSR hydration mismatch
  const [storedValue, setStoredValue] = useState(initialValue);

  // After mount, read from localStorage
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        setStoredValue(JSON.parse(item));
      }
    } catch (err) {
      console.warn(`[useLocalStorage] Failed to read "${key}":`, err);
    }
  }, [key]);

  const setValue = useCallback(
    (value) => {
      try {
        const next =
          value instanceof Function ? value(storedValue) : value;
        setStoredValue(next);
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch (err) {
        console.warn(`[useLocalStorage] Failed to write "${key}":`, err);
      }
    },
    [key, storedValue]
  );

  const clearValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (err) {
      console.warn(`[useLocalStorage] Failed to clear "${key}":`, err);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, clearValue];
}
