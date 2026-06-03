import {
    BrunoVariableReference,
    BrunoVariableType,
    VariableReferenceType,
} from "@global_shared";
import { isDynamicVariableReference } from "./isDynamicVariableReference";

export function filterDynamicReferences(
    allDynamicReferences: BrunoVariableReference[],
    referenceTypeInSourceFile: VariableReferenceType,
    variableTypeInSourceFile: BrunoVariableType,
) {
    const relevantReferenceType = getRelevantReferenceType(
        referenceTypeInSourceFile,
    );
    const relevantVariableTypes = getRelevantVariableTypes(
        variableTypeInSourceFile,
    );

    return allDynamicReferences.filter(
        ({ referenceType, variableType, scope }) =>
            isDynamicVariableReference(scope) &&
            referenceType == relevantReferenceType &&
            relevantVariableTypes.includes(variableType),
    );
}

function getRelevantReferenceType(
    referenceTypeInSourceFile: VariableReferenceType,
) {
    return referenceTypeInSourceFile == VariableReferenceType.Write
        ? VariableReferenceType.Read
        : VariableReferenceType.Write;
}

function getRelevantVariableTypes(variableTypeInSourceFile: BrunoVariableType) {
    return variableTypeInSourceFile == BrunoVariableType.Unknown
        ? Object.values(BrunoVariableType)
        : [variableTypeInSourceFile, BrunoVariableType.Unknown];
}
