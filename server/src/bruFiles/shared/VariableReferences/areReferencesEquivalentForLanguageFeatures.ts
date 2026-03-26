import { BrunoVariableReference, BrunoVariableType } from "@global_shared";

export function areReferencesEquivalentForLanguageFeatures(
    ref1: BrunoVariableReference,
    ref2: BrunoVariableReference,
) {
    const areVariableTypesEquivalent =
        ref1.variableType == BrunoVariableType.Unknown ||
        ref2.variableType == BrunoVariableType.Unknown ||
        ref1.variableType == ref2.variableType;

    return (
        areVariableTypesEquivalent &&
        ref1.referenceType == ref2.referenceType &&
        ref1.variableName == ref2.variableName
    );
}
