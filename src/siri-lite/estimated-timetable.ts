import { SIRI_LITE_API_KEY, SIRI_LITE_API_URL } from "../config.js";

import type { SiriLiteResponse } from "./responses.js";

export async function fetchEstimatedTimetable() {
	const response = await fetch(`${SIRI_LITE_API_URL}/estimated-timetable`, {
		headers: {
			apiKey: SIRI_LITE_API_KEY,
		},
	});

	if (!response.ok) {
		throw new Error(`Unable to fetch estimated timetable (http status ${response.status}).`);
	}

	const payload = (await response.json()) as SiriLiteResponse;
	return payload;
}
