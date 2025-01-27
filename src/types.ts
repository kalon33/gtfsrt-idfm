export type SiriLiteResponse = {
	Siri: {
		ServiceDelivery: ServiceDelivery;
	};
};

export type ServiceDelivery = {
	ResponseTimestamp: string;
	RequestMessageRef: string | null;
	EstimatedTimetableDelivery: [EstimatedTimetableDelivery];
};

export type EstimatedTimetableDelivery = {
	version: "2.0";
	ResponseTimestamp: string;
	ValidUntil: string;
	ShortestPossibleCycle: string;
	EstimatedJourneyVersionFrame: EstimatedJourneyVersionFrame[];
};

export type EstimatedJourneyVersionFrame = {
	RecordedAtTime: string;
	EstimatedVehicleJourney: [EstimatedVehicleJourney];
};

export type EstimatedVehicleJourney = {
	RecordedAtTime: string;
	LineRef: {
		value: string;
	};
	DatedVehicleJourneyRef: {
		value: string;
	};
	EstimatedCalls: {
		EstimatedCall: EstimatedCall[];
	};
};

export type EstimatedCall = {
	StopPointRef: {
		value: string;
	};
	ExpectedArrivalTime: string;
	ExpectedDepartureTime: string;
};
