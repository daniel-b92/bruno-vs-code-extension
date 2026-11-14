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
    const relevantReferenceTypes = getRelevantReferenceTypes(
        referenceTypeInSourceFile,
    );
    const relevantVariableTypes = getRelevantVariableTypes(
        variableTypeInSourceFile,
    );

    return allDynamicReferences.filter(
        ({ referenceType, variableType, scope }) =>
            isDynamicVariableReference(scope) &&
            relevantReferenceTypes.includes(referenceType) &&
            relevantVariableTypes.includes(variableType),
    );
}

function getRelevantReferenceTypes(
    referenceTypeInSourceFile: VariableReferenceType,
) {
    return referenceTypeInSourceFile == VariableReferenceType.Write
        ? [VariableReferenceType.Read, VariableReferenceType.Delete]
        : [VariableReferenceType.Write];
}

function getRelevantVariableTypes(variableTypeInSourceFile: BrunoVariableType) {
    return variableTypeInSourceFile == BrunoVariableType.Unknown
        ? Object.values(BrunoVariableType)
        : [variableTypeInSourceFile, BrunoVariableType.Unknown];
}
