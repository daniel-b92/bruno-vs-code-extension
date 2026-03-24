import {
    Block,
    getBlocksWithEarlierExecutionGroups,
    getBlocksWithLaterExecutionGroups,
    isBlockCodeBlock,
    VariableReferenceType,
    Position,
    BrunoVariableType,
} from "@global_shared";
import { BlockRequestWithAdditionalData } from "../interfaces";

export function getDynamicVariableReferencesWithinFile(
    {
        request: { position: requestPosition, token },
        file: { allBlocks, blockContainingPosition },
        logger,
    }: BlockRequestWithAdditionalData<Block>,
    referenceType: VariableReferenceType,
    variableType: BrunoVariableType,
) {
    const relevantReferenceType =
        referenceType == VariableReferenceType.Write
            ? VariableReferenceType.Read
            : VariableReferenceType.Write;

    const { otherRelevantBlocks, fromOwnBlock } =
        referenceType == VariableReferenceType.Read
            ? getReferencesForEarlierExecutionTimes(
                  requestPosition,
                  blockContainingPosition,
                  allBlocks,
                  relevantReferenceType,
                  variableType,
              )
            : getReferencesForLaterExecutionTimes(
                  requestPosition,
                  blockContainingPosition,
                  allBlocks,
                  relevantReferenceType,
                  variableType,
              );

    if (fromOwnBlock.length == 0 && otherRelevantBlocks.length == 0) {
        return [];
    }

    if (token.isCancellationRequested) {
        logger?.debug("Cancellation requested for language feature.");
        return [];
    }

    return fromOwnBlock
        .map((variableReference) => ({
            blockName: blockContainingPosition.name,
            variableReference,
        }))
        .concat(
            otherRelevantBlocks
                .flatMap(({ name: blockName, variableReferences: refs }) =>
                    refs && refs.length > 0
                        ? refs
                              .filter(
                                  ({ referenceType }) =>
                                      referenceType == relevantReferenceType,
                              )
                              .map((ref) => ({
                                  blockName,
                                  variableReference: ref,
                              }))
                        : undefined,
                )
                .filter((v) => v != undefined),
        );
}

function getReferencesForEarlierExecutionTimes(
    requestPosition: Position,
    blockContainingPosition: Block,
    allBlocks: Block[],
    relevantReferenceType: VariableReferenceType,
    relevantVariableType: BrunoVariableType,
) {
    const otherRelevantBlocks = getBlocksWithEarlierExecutionGroups(
        blockContainingPosition.name,
        allBlocks,
    );

    return {
        otherRelevantBlocks,
        fromOwnBlock: getReferencesFromOwnBlock(
            requestPosition,
            blockContainingPosition,
            relevantReferenceType,
            relevantVariableType,
            true,
        ),
    };
}

function getReferencesForLaterExecutionTimes(
    requestPosition: Position,
    blockContainingPosition: Block,
    allBlocks: Block[],
    relevantReferenceType: VariableReferenceType,
    relevantVariableType: BrunoVariableType,
) {
    const otherRelevantBlocks = getBlocksWithLaterExecutionGroups(
        blockContainingPosition.name,
        allBlocks,
    );

    return {
        otherRelevantBlocks,
        fromOwnBlock: getReferencesFromOwnBlock(
            requestPosition,
            blockContainingPosition,
            relevantReferenceType,
            relevantVariableType,
            false,
        ),
    };
}

function getReferencesFromOwnBlock(
    requestPosition: Position,
    ownBlock: Block,
    relevantReferenceType: VariableReferenceType,
    relevantVariableType: BrunoVariableType,
    forEarlierExecutionTimes: boolean,
) {
    if (
        // Only for code blocks the block execution order is defined (from top to bottom).
        !isBlockCodeBlock(ownBlock) ||
        ownBlock.variableReferences == undefined
    ) {
        return [];
    }

    const prefiltered = ownBlock.variableReferences.filter(
        ({ referenceType, variableType }) =>
            referenceType == relevantReferenceType &&
            (relevantVariableType != BrunoVariableType.Unknown
                ? variableType == relevantVariableType
                : true),
    );

    return prefiltered.filter(({ variableNameRange }) =>
        forEarlierExecutionTimes
            ? variableNameRange.end.isBefore(requestPosition)
            : requestPosition.isBefore(variableNameRange.start),
    );
}
