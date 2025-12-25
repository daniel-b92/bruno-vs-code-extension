import { CancellationToken, Position as VsCodePosition } from "vscode";
import {
    Block,
    BrunoVariableType,
    getBlocksWithEarlierExecutionGroups,
    getBlocksWithLaterExecutionGroups,
    isBlockCodeBlock,
    mapFromVsCodePosition,
    OutputChannelLogger,
    VariableReferenceType,
} from "../../../../shared";

export function getDynamicVariableReferences(
    requestData: {
        functionType: VariableReferenceType;
        requestPosition: VsCodePosition;
        token: CancellationToken;
    },
    blockContainingPosition: Block,
    allBlocks: Block[],
    logger?: OutputChannelLogger,
) {
    const { functionType, requestPosition, token } = requestData;
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
                  VariableReferenceType.Write,
              )
            : getDynamicVariableReferencesForLaterExecutionTimes(
                  requestPosition,
                  blockContainingPosition,
                  allBlocks,
                  VariableReferenceType.Read,
              );

    if (otherRelevantBlocks.length == 0) {
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
    requestPosition: VsCodePosition,
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
                      variableNameRange.end.isBefore(
                          mapFromVsCodePosition(requestPosition),
                      ),
              )
            : [];

    return {
        otherRelevantBlocks,
        fromOwnBlock,
    };
}

function getDynamicVariableReferencesForLaterExecutionTimes(
    requestPosition: VsCodePosition,
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
                      mapFromVsCodePosition(requestPosition).isBefore(
                          variableNameRange.start,
                      ),
              )
            : [];

    return {
        otherRelevantBlocks,
        fromOwnBlock,
    };
}
