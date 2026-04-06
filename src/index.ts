import { setTimeout } from "node:timers/promises";
import { serve } from "@hono/node-server";
import GtfsRealtime from "gtfs-realtime-bindings";
import { Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { Temporal } from "temporal-polyfill";

import { PORT, REFRESH_INTERVAL } from "./config.js";
import { handleRequest } from "./gtfs-rt/handle-request.js";
import { useRealtimeStore } from "./gtfs-rt/use-realtime-store.js";
import { fetchEstimatedTimetable } from "./siri-lite/estimated-timetable.js";
import { loadStopExtensions } from "./utils/parse-extensions.js";

console.log(` ,----.,--------.,------.,---.        ,------.,--------. ,--.,------.  ,------.,--.   ,--. 
'  .-./'--.  .--'|  .---'   .-',-----.|  .--. '--.  .--' |  ||  .-.  \\ |  .---'|   \`.'   | 
|  | .---.|  |   |  \`--,\`.  \`-.'-----'|  '--'.'  |  |    |  ||  |  \\  :|  \`--, |  |'.'|  | 
'  '--'  ||  |   |  |\`  .-'    |      |  |\\  \\   |  |    |  ||  '--'  /|  |\`   |  |   |  | 
 \`------' \`--'   \`--'   \`-----'       \`--' '--'  \`--'    \`--'\`-------' \`--'    \`--'   \`--'`);

const store = useRealtimeStore();

const hono = new Hono();
hono.use(
	rateLimiter({
		windowMs: 10_000,
		limit: 1,
		keyGenerator: (c) => `${c.req.header("CF-Connecting-IP")}_${c.req.method}_${c.req.path}`,
		handler: (c) => c.json({ code: 429, message: "Too many requests, please try again later." }, 429),
	}),
);
hono.get("/trip-updates", (c) => handleRequest(c, "protobuf", store.tripUpdates, null));
hono.get("/trip-updates.json", (c) => handleRequest(c, "json", store.tripUpdates, null));
hono.get("/vehicle-positions", (c) => handleRequest(c, "protobuf", null, store.vehiclePositions));
hono.get("/vehicle-positions.json", (c) => handleRequest(c, "json", null, store.vehiclePositions));
hono.get("/", (c) =>
	handleRequest(c, c.req.query("format") === "json" ? "json" : "protobuf", store.tripUpdates, store.vehiclePositions),
);
serve({ fetch: hono.fetch, port: PORT });
console.log(`➔ Listening on :${PORT}`);

const stopExtensions = await loadStopExtensions();

while (true) {
	const startedAt = Date.now();
	let error: unknown | undefined;

	try {
		console.log("➔ Fetching estimated timetable from provider");

		const estimatedTimetable = await fetchEstimatedTimetable();
		const frame = estimatedTimetable.Siri.ServiceDelivery.EstimatedTimetableDelivery[0].EstimatedJourneyVersionFrame[0];

		for (const journey of frame.EstimatedVehicleJourney) {
			if (!journey.DatedVehicleJourneyRef.value.includes("SNCF")) {
				continue;
			}

			const tripId = `IDFM:TN:SNCF:${journey.DatedVehicleJourneyRef.value.split(":")[3]}`;
			const recordedAt = Temporal.Instant.from(journey.RecordedAtTime);

			store.tripUpdates.set(`ET:${tripId}`, {
				stopTimeUpdate: journey.EstimatedCalls.EstimatedCall.map(
					({
						StopPointRef,
						ExpectedArrivalTime,
						ExpectedDepartureTime,
						DepartureStatus,
						ArrivalStatus,
						ArrivalPlatformName,
					}) => ({
						...(ArrivalStatus !== "CANCELLED" && DepartureStatus !== "CANCELLED"
							? {
									arrival: ExpectedArrivalTime
										? { time: Math.floor(Temporal.Instant.from(ExpectedArrivalTime).epochMilliseconds / 1000) }
										: undefined,
									departure: ExpectedDepartureTime
										? { time: Math.floor(Temporal.Instant.from(ExpectedDepartureTime).epochMilliseconds / 1000) }
										: undefined,
									scheduleRelationship:
										GtfsRealtime.transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SCHEDULED,
								}
							: {
									scheduleRelationship:
										GtfsRealtime.transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED,
								}),
						stopId: stopExtensions.get(StopPointRef.value.split(":")[3]),
						stopTimeProperties:
							typeof ArrivalPlatformName?.value === "string" && ArrivalPlatformName?.value !== "unknown"
								? {
										// is not actually a stop id but a quay name
										assignedStopId: ArrivalPlatformName?.value ? `Voie ${ArrivalPlatformName.value}` : undefined,
									}
								: undefined,
					}),
				),
				timestamp: Math.floor(recordedAt.epochMilliseconds / 1000),
				trip: {
					tripId,
					scheduleRelationship: GtfsRealtime.transit_realtime.TripDescriptor.ScheduleRelationship.SCHEDULED,
				},
			});
		}
	} catch (cause) {
		error = cause;
	} finally {
		const waitingTime = Math.max(REFRESH_INTERVAL - (Date.now() - startedAt), 0);

		if (error !== undefined) {
			console.error(`✘ Failed to compute vehicle batch, retrying in ${waitingTime}ms`, error);
		} else {
			console.log(`✓ Done processing vehicle batch, waiting for ${waitingTime}ms`);
		}

		await setTimeout(waitingTime);
	}
}
