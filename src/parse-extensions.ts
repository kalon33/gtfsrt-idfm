import { readCsv } from "./csv-reader.js";

export async function parseExtensions() {
	const stifToGtfsId = new Map();
	await readCsv<{ object_id: string; object_code: string }>("./data/stop_extensions.txt", (record) => {
		stifToGtfsId.set(
			record.object_code.startsWith("monomodalStopPlace:")
				? record.object_code.slice("monomodalStopPlace:".length)
				: record.object_code,
			record.object_id,
		);
	});
	return stifToGtfsId;
}
