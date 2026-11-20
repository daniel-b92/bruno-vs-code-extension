import { BrunoVariableType, VariableReferenceType } from "@global_shared";

export interface ComparableReference {
    variableName: string;
    variableType: BrunoVariableType;
    referenceType: VariableReferenceType;
}

export function areReferencesEquivalentForLanguageFeatures(
    ref1: ComparableReference,
    ref2: ComparableReference,
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
