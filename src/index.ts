import { serve } from "@hono/node-server";
import dayjs from "dayjs";
import GtfsRealtime from "gtfs-realtime-bindings";
import { Hono } from "hono";

import { fetchData } from "./fetch-data.js";
import { parseExtensions } from "./parse-extensions.js";

const stifToGtfsId = await parseExtensions();

async function generateTripUpdate() {
	const data = await fetchData();

	const frame = data.Siri.ServiceDelivery.EstimatedTimetableDelivery[0].EstimatedJourneyVersionFrame[0];

	return {
		header: {
			gtfsRealtimeVersion: "2.0",
			timestamp: dayjs(data.Siri.ServiceDelivery.ResponseTimestamp).unix(),
			incrementality: GtfsRealtime.transit_realtime.FeedHeader.Incrementality.FULL_DATASET,
		},
		entity: frame?.EstimatedVehicleJourney.flatMap((EstimatedVehicleJourney) => {
			if (!EstimatedVehicleJourney.DatedVehicleJourneyRef.value.includes("SNCF")) return [];

			const tripId = `IDFM:TN:SNCF:${EstimatedVehicleJourney.DatedVehicleJourneyRef.value.split(":")[3]}`;
			return {
				id: `SM:${tripId}`,
				tripUpdate: {
					stopTimeUpdate: EstimatedVehicleJourney.EstimatedCalls.EstimatedCall.map(
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
										arrival: ExpectedArrivalTime ? { time: dayjs(ExpectedArrivalTime).unix() } : undefined,
										departure: ExpectedDepartureTime ? { time: dayjs(ExpectedDepartureTime).unix() } : undefined,
										scheduleRelationship:
											GtfsRealtime.transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SCHEDULED,
									}
								: {
										scheduleRelationship:
											GtfsRealtime.transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED,
									}),
							stopId: stifToGtfsId.get(StopPointRef.value.split(":")[3]),
							stopTimeProperties:
								typeof ArrivalPlatformName?.value === "string" && ArrivalPlatformName?.value !== "unknown"
									? {
											// is not actually a stop id but a quay name
											assignedStopId: ArrivalPlatformName?.value ? `Voie ${ArrivalPlatformName.value}` : undefined,
										}
									: undefined,
						}),
					),
					timestamp: dayjs(EstimatedVehicleJourney.RecordedAtTime).unix(),
					trip: {
						tripId,
						scheduleRelationship: GtfsRealtime.transit_realtime.TripDescriptor.ScheduleRelationship.SCHEDULED,
					},
				},
			};
		}),
	};
}

const hono = new Hono();

hono.get("/trip-updates.json", async (c) => {
	const tripUpdate = await generateTripUpdate();
	return c.json(tripUpdate);
});

hono.get("/trip-updates", async (c) => {
	const tripUpdate = await generateTripUpdate();
	const serialized = GtfsRealtime.transit_realtime.FeedMessage.encode(tripUpdate);
	return c.body(serialized.finish(), 200, {
		"Content-Type": "application/octet-stream",
	});
});

serve({ fetch: hono.fetch, port: +(process.env.PORT ?? 3000) });
console.log(`Listening on port ${process.env.PORT ?? 3000}`);
