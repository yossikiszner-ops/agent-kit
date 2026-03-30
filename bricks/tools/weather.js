/**
 * bricks/tools/weather.js — Current weather & forecasts
 *
 * No API key required. Uses Open-Meteo — completely free, no signup.
 * Geocoding via nominatim.openstreetmap.org (also free).
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";

const WMO_CODES = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Icy fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Moderate snow",
  75: "Heavy snow",
  80: "Light showers",
  81: "Moderate showers",
  82: "Heavy showers",
  95: "Thunderstorm",
  99: "Thunderstorm with hail",
};

const brick = {
  name: "weather",
  description:
    "Get current weather conditions and a 7-day forecast for any city or location. " +
    "No API key needed. Returns temperature, humidity, wind speed, and conditions. " +
    "Always use this for weather questions — never guess based on location.",

  parameters: z.object({
    location: z
      .string()
      .min(2)
      .max(200)
      .describe(
        "City name or location, e.g. 'Mumbai', 'New York', 'London, UK'"
      ),
    units: z
      .enum(["celsius", "fahrenheit"])
      .optional()
      .default("celsius")
      .describe("Temperature units (default: celsius)"),
    includeForecast: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include a 7-day forecast"),
  }),

  execute: async ({ location, units = "celsius", includeForecast = false }) => {
    // Step 1: geocode the location
    const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;
    const geoRes = await fetch(geoUrl, {
      headers: { "User-Agent": "AgentKit/1.0" },
      signal: AbortSignal.timeout(8_000),
    });

    if (!geoRes.ok) {
      return { error: `Could not find location: "${location}"` };
    }

    const geoData = await geoRes.json();
    if (!geoData.length) {
      return {
        error: `Location "${location}" not found. Try a more specific name.`,
      };
    }

    const { lat, lon, display_name } = geoData[0];

    // Step 2: fetch weather from Open-Meteo
    const tempUnit = units === "fahrenheit" ? "fahrenheit" : "celsius";
    const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
    weatherUrl.searchParams.set("latitude", lat);
    weatherUrl.searchParams.set("longitude", lon);
    weatherUrl.searchParams.set("temperature_unit", tempUnit);
    weatherUrl.searchParams.set(
      "current",
      [
        "temperature_2m",
        "apparent_temperature",
        "relative_humidity_2m",
        "wind_speed_10m",
        "wind_direction_10m",
        "weather_code",
        "is_day",
        "precipitation",
      ].join(",")
    );
    if (includeForecast) {
      weatherUrl.searchParams.set(
        "daily",
        ["temperature_2m_max", "temperature_2m_min", "weather_code", "precipitation_sum"].join(",")
      );
      weatherUrl.searchParams.set("forecast_days", "7");
    }
    weatherUrl.searchParams.set("timezone", "auto");

    const weatherRes = await fetch(weatherUrl.toString(), {
      signal: AbortSignal.timeout(8_000),
    });
    if (!weatherRes.ok) {
      throw new Error(`Open-Meteo error: ${weatherRes.status}`);
    }

    const w = await weatherRes.json();
    const cur = w.current;
    const unit = units === "fahrenheit" ? "°F" : "°C";

    const result = {
      location: display_name.split(",").slice(0, 3).join(","),
      coordinates: { lat: parseFloat(lat), lon: parseFloat(lon) },
      current: {
        condition: WMO_CODES[cur.weather_code] ?? "Unknown",
        temperature: `${Math.round(cur.temperature_2m)}${unit}`,
        feelsLike: `${Math.round(cur.apparent_temperature)}${unit}`,
        humidity: `${cur.relative_humidity_2m}%`,
        wind: `${Math.round(cur.wind_speed_10m)} km/h`,
        precipitation: `${cur.precipitation} mm`,
        isDay: cur.is_day === 1,
      },
    };

    if (includeForecast && w.daily) {
      result.forecast = w.daily.time.map((date, i) => ({
        date,
        condition: WMO_CODES[w.daily.weather_code[i]] ?? "Unknown",
        high: `${Math.round(w.daily.temperature_2m_max[i])}${unit}`,
        low: `${Math.round(w.daily.temperature_2m_min[i])}${unit}`,
        precipitation: `${w.daily.precipitation_sum[i]} mm`,
      }));
    }

    return result;
  },

  onError: (err) => `Weather lookup failed: ${err.message}`,
};

export default brick;
