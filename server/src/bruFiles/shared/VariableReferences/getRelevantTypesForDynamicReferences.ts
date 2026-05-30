import { BrunoVariableType, VariableReferenceType } from "@global_shared";

export function getRelevantTypesForDynamicReferences(
    referenceTypeInSourceFile: VariableReferenceType,
    variableTypeInSourceFile: BrunoVariableType,
) {
    return {
        referenceType:
            referenceTypeInSourceFile == VariableReferenceType.Write
                ? VariableReferenceType.Read
                : VariableReferenceType.Write,
        variableTypes:
            variableTypeInSourceFile == BrunoVariableType.Unknown
                ? Object.values(BrunoVariableType)
                : [variableTypeInSourceFile, BrunoVariableType.Unknown],
    };
}
