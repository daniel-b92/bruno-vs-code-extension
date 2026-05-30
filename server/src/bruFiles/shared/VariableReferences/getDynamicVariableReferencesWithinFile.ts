import {
    Block,
    BrunoVariableType,
    getBlocksWithEarlierExecutionGroups,
    getBlocksWithLaterExecutionGroups,
    VariableReferenceType,
} from "@global_shared";
import { BlockRequestWithAdditionalData } from "../interfaces";
import { isDynamicVariableReference } from "./isDynamicVariableReference";
import { getRelevantTypesForDynamicReferences } from "./getRelevantTypesForDynamicReferences";

export function getDynamicVariableReferencesWithinFile(
    {
        request: { token },
        file: { allBlocks, blockContainingPosition },
        logger,
    }: BlockRequestWithAdditionalData<Block>,
    referenceTypeInSourceFile: VariableReferenceType,
    variableTypeInSourceFile: BrunoVariableType,
) {
    const {
        referenceType: relevantReferenceType,
        variableTypes: relevantVariableTypes,
    } = getRelevantTypesForDynamicReferences(
        referenceTypeInSourceFile,
        variableTypeInSourceFile,
    );

    const { otherRelevantBlocks } =
        referenceTypeInSourceFile == VariableReferenceType.Read
            ? getReferencesForEarlierExecutionTimes(
                  blockContainingPosition,
                  allBlocks,
              )
            : getReferencesForLaterExecutionTimes(
                  blockContainingPosition,
                  allBlocks,
              );

    if (otherRelevantBlocks.length == 0) {
        return [];
    }

    if (token.isCancellationRequested) {
        logger?.debug("Cancellation requested for language feature.");
        return [];
    }

    return otherRelevantBlocks
        .flatMap(({ name: blockName, variableReferences: refs }) =>
            refs && refs.length > 0
                ? refs
                      .filter(
                          ({ referenceType, variableType, scope }) =>
                              isDynamicVariableReference(scope) &&
                              referenceType == relevantReferenceType &&
                              relevantVariableTypes.includes(variableType),
                      )
                      .map((ref) => ({
                          blockName,
                          variableReference: ref,
                      }))
                : undefined,
        )
        .filter((v) => v != undefined);
}

function getReferencesForEarlierExecutionTimes(
    blockContainingPosition: Block,
    allBlocks: Block[],
) {
    return {
        otherRelevantBlocks: getBlocksWithEarlierExecutionGroups(
            blockContainingPosition.name,
            allBlocks,
        ),
    };
}

function getReferencesForLaterExecutionTimes(
    blockContainingPosition: Block,
    allBlocks: Block[],
) {
    return {
        otherRelevantBlocks: getBlocksWithLaterExecutionGroups(
            blockContainingPosition.name,
            allBlocks,
        ),
    };
}
