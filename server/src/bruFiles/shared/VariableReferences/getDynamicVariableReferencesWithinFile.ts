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
