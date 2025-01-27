import dayjs from "dayjs";
import type { SiriLiteResponse } from "./types.js";

if (typeof process.env.API_TOKEN === "undefined") {
	throw new Error('Expected environment variable "API_TOKEN" to be defined.');
}

let cache: SiriLiteResponse;

const isCacheFresh = () => {
	if (typeof cache === "undefined") return false;
	return (
		dayjs().diff(cache.Siri.ServiceDelivery.ResponseTimestamp, "seconds") < 60
	);
};

export async function fetchData() {
	if (isCacheFresh()) return cache;

	const response = await fetch(
		"https://prim.iledefrance-mobilites.fr/marketplace/estimated-timetable",
		{
			headers: {
				// biome-ignore lint/style/noNonNullAssertion: process crashes if not supplied
				apiKey: process.env.API_TOKEN!,
			},
		},
	);

	if (!response.ok) {
		throw new Error(`Failed to fetch latest data (status ${response.status})`);
	}

	const payload = (await response.json()) as SiriLiteResponse;
	cache = payload;
	return payload;
}
