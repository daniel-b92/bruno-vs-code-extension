import {
    BrunoVariableType,
    getSectionsWithEarlierExecutionGroups,
    getSectionsWithLaterExecutionGroups,
    VariableReferenceType,
} from "@global_shared";
import { VariableSectionRequest } from "./interfaces";
import { filterDynamicReferences } from "./filterDynamicReferences";

export function getDynamicVariableReferencesWithinFile(
    {
        request: { token },
        file: { allSections, sectionContainingPosition },
        logger,
    }: VariableSectionRequest,
    referenceTypeInSourceFile: VariableReferenceType,
    variableTypeInSourceFile: BrunoVariableType,
) {
    const otherRelevantSections =
        referenceTypeInSourceFile == VariableReferenceType.Read
            ? getSectionsWithEarlierExecutionGroups(
                  sectionContainingPosition.kind,
                  allSections,
              )
            : getSectionsWithLaterExecutionGroups(
                  sectionContainingPosition.kind,
                  allSections,
              );

    if (otherRelevantSections.length == 0) {
        return [];
    }

    if (token.isCancellationRequested) {
        logger?.debug("Cancellation requested for language feature.");
        return [];
    }

    return otherRelevantSections
        .flatMap(({ name: blockName, variableReferences: refs }) =>
            refs && refs.length > 0
                ? filterDynamicReferences(
                      refs,
                      referenceTypeInSourceFile,
                      variableTypeInSourceFile,
                  ).map((ref) => ({
                      blockName,
                      variableReference: ref,
                  }))
                : undefined,
        )
        .filter((v) => v != undefined);
}
