import { BrunoVariableReference } from "./contentInterfaces";

export function areVariableReferencesEquivalent(
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
