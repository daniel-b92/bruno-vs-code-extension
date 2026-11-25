const defaultSequenceStep = 1;

/** Returns the default step if the value of the setting `bru-as-code.sequenceStep` is not a positive integer. */
export function parseSequenceStep(configuredValue: unknown) {
    return typeof configuredValue == "number" &&
        Number.isInteger(configuredValue) &&
        configuredValue > 0
        ? configuredValue
        : defaultSequenceStep;
}
