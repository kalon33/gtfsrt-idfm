import { Temporal } from "temporal-polyfill";

if (process.env.API_TOKEN === undefined) {
	throw new Error("Environment variable 'API_TOKEN' must be set!");
}

export const PORT = +(process.env.PORT ?? 3000);
export const REFRESH_INTERVAL = Temporal.Duration.from({ seconds: 120 }).total("milliseconds");
export const SIRI_LITE_API_KEY = process.env.API_TOKEN;
export const SIRI_LITE_API_URL = "https://prim.iledefrance-mobilites.fr/marketplace";
export const SWEEP_THRESHOLD = Temporal.Duration.from({ minutes: 10 }).total("milliseconds");
