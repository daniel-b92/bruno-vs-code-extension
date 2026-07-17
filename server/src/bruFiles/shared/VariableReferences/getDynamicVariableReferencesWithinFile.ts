import {
    Block,
    BrunoVariableType,
    getBlocksWithEarlierExecutionGroups,
    getBlocksWithLaterExecutionGroups,
    VariableReferenceType,
} from "@global_shared";
import { BlockRequestWithAdditionalData } from "../interfaces";
import { filterDynamicReferences } from "./filterDynamicReferences";

export function getDynamicVariableReferencesWithinFile(
    {
        request: { token },
        file: { allBlocks, blockContainingPosition },
        logger,
    }: BlockRequestWithAdditionalData<Block>,
    referenceTypeInSourceFile: VariableReferenceType,
    variableTypeInSourceFile: BrunoVariableType,
) {
    const otherRelevantBlocks =
        referenceTypeInSourceFile == VariableReferenceType.Read
            ? getRelevantBlocksForEarlierExecutionTimes(
                  blockContainingPosition,
                  allBlocks,
              )
            : getRelevantBlocksForLaterExecutionTimes(
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

function getRelevantBlocksForEarlierExecutionTimes(
    blockContainingPosition: Block,
    allBlocks: Block[],
) {
    return getBlocksWithEarlierExecutionGroups(
        blockContainingPosition.name,
        allBlocks,
    );
}

function getRelevantBlocksForLaterExecutionTimes(
    blockContainingPosition: Block,
    allBlocks: Block[],
) {
    return getBlocksWithLaterExecutionGroups(
        blockContainingPosition.name,
        allBlocks,
    );
}
