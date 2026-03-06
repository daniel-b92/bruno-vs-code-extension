import { BrunoVariableReference } from "./contentInterfaces";

export function areVariableReferencesEquivalent(
    references1: BrunoVariableReference[],
    references2: BrunoVariableReference[],
) {
    return (
        references1.length == references2.length &&
        references1.every((ref1) =>
            references2.some((ref2) => areEquivalent(ref1, ref2)),
        )
    );
}

export function areEquivalent(
    ref1: BrunoVariableReference,
    ref2: BrunoVariableReference,
) {
    return (
        ref1.referenceType == ref2.referenceType &&
        ref1.variableName == ref2.variableName &&
        ref1.variableNameRange.equals(ref2.variableNameRange) &&
        ref1.variableType == ref2.variableType
    );
}
