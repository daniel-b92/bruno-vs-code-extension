import {
    Block,
    BrunoVariableType,
    getBlocksWithEarlierExecutionGroups,
    getBlocksWithLaterExecutionGroups,
    isBlockCodeBlock,
    VariableReferenceType,
    Position,
} from "@global_shared";
import { BlockRequestWithAdditionalData } from "./interfaces";

export function getDynamicVariableReferences(
    {
        request: { position: requestPosition, token },
        file: { allBlocks, blockContainingPosition },
        logger,
    }: BlockRequestWithAdditionalData<Block>,
    functionType: VariableReferenceType,
) {
    const relevantReferenceType =
        functionType == VariableReferenceType.Write
            ? VariableReferenceType.Read
            : VariableReferenceType.Write;

    const { otherRelevantBlocks, fromOwnBlock } =
        functionType == VariableReferenceType.Read
            ? getDynamicVariableReferencesForEarlierExecutionTimes(
                  requestPosition,
                  blockContainingPosition,
                  allBlocks,
                  relevantReferenceType,
              )
            : getDynamicVariableReferencesForLaterExecutionTimes(
                  requestPosition,
                  blockContainingPosition,
                  allBlocks,
                  relevantReferenceType,
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
        )
        .filter(
            ({ variableReference: { variableType } }) =>
                variableType == BrunoVariableType.Unknown ||
                variableType == BrunoVariableType.Environment,
        );
}

function getDynamicVariableReferencesForEarlierExecutionTimes(
    requestPosition: Position,
    blockContainingPosition: Block,
    allBlocks: Block[],
    relevantReferenceType: VariableReferenceType,
) {
    const otherRelevantBlocks = getBlocksWithEarlierExecutionGroups(
        blockContainingPosition.name,
        allBlocks,
    );

    const fromOwnBlock =
        isBlockCodeBlock(blockContainingPosition) &&
        blockContainingPosition.variableReferences != undefined
            ? blockContainingPosition.variableReferences.filter(
                  ({ referenceType, variableNameRange }) =>
                      referenceType == relevantReferenceType &&
                      variableNameRange.end.isBefore(requestPosition),
              )
            : [];

    return {
        otherRelevantBlocks,
        fromOwnBlock,
    };
}

function getDynamicVariableReferencesForLaterExecutionTimes(
    requestPosition: Position,
    blockContainingPosition: Block,
    allBlocks: Block[],
    relevantReferenceType: VariableReferenceType,
) {
    const otherRelevantBlocks = getBlocksWithLaterExecutionGroups(
        blockContainingPosition.name,
        allBlocks,
    );

    const fromOwnBlock =
        isBlockCodeBlock(blockContainingPosition) &&
        blockContainingPosition.variableReferences != undefined
            ? blockContainingPosition.variableReferences.filter(
                  ({ referenceType, variableNameRange }) =>
                      referenceType == relevantReferenceType &&
                      requestPosition.isBefore(variableNameRange.start),
              )
            : [];

    return {
        otherRelevantBlocks,
        fromOwnBlock,
    };
}
