import { parseCsv } from "./parse-csv.js";

type StopExtensionRecord = { object_id: string; object_code: string };

export async function loadStopExtensions() {
	console.log("➔ Loading stop extensions from file");

	const stopExtensions = new Map<string, string>();

	await parseCsv<StopExtensionRecord>("./data/stop_extensions.txt", (record) => {
		stopExtensions.set(
			record.object_code.startsWith("monomodalStopPlace:")
				? record.object_code.slice("monomodalStopPlace:".length)
				: record.object_code,
			record.object_id,
		);
	});

	return stopExtensions;
}
