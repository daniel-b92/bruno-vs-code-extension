import {
    Block,
    getBlocksWithEarlierExecutionGroups,
    getBlocksWithLaterExecutionGroups,
    VariableReferenceType,
} from "@global_shared";
import { BlockRequestWithAdditionalData } from "../interfaces";
import { isDynamicVariableReference } from "./isDynamicVariableReference";

export function getDynamicVariableReferencesWithinFile(
    {
        request: { token },
        file: { allBlocks, blockContainingPosition },
        logger,
    }: BlockRequestWithAdditionalData<Block>,
    referenceType: VariableReferenceType,
) {
    const relevantReferenceType =
        referenceType == VariableReferenceType.Write
            ? VariableReferenceType.Read
            : VariableReferenceType.Write;

    const { otherRelevantBlocks } =
        referenceType == VariableReferenceType.Read
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
                          ({ referenceType, scope }) =>
                              isDynamicVariableReference(scope) &&
                              referenceType == relevantReferenceType,
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
