import { basename } from "path";
import {
    CompletionItem,
    CompletionItemKind,
    Position as VsCodePosition,
} from "vscode";
import {
    Block,
    BrunoVariableType,
    getBlocksWithEarlierExecutionGroups,
    getBlocksWithLaterExecutionGroups,
    getExtensionForBrunoFiles,
    isBlockCodeBlock,
    mapFromVsCodePosition,
    VariableReferenceType,
} from "../../../../shared";

export function mapEnvVariablesToCompletions(
    matchingStaticEnvVariables: {
        environmentFile: string;
        matchingVariableKeys: string[];
        isConfiguredEnv: boolean;
    }[],
    requestData: {
        functionType: VariableReferenceType;
        requestPosition: VsCodePosition;
    },
    dynamicVariablesData?: {
        blockContainingPosition: Block;
        allBlocks: Block[];
    },
) {
    const { functionType } = requestData;

    return (
        dynamicVariablesData
            ? mapDynamicEnvVariables(requestData, dynamicVariablesData, "a")
            : []
    )
        .filter(
            ({ label }) =>
                !matchingStaticEnvVariables
                    .flatMap(({ matchingVariableKeys }) => matchingVariableKeys)
                    .some((key) =>
                        typeof label == "string"
                            ? key == label
                            : key == label.label,
                    ),
        )
        .concat(
            mapStaticEnvVariables(
                matchingStaticEnvVariables,
                functionType,
                "b",
            ),
        );
}

function mapDynamicEnvVariables(
    requestData: {
        functionType: VariableReferenceType;
        requestPosition: VsCodePosition;
    },
    dynamicVariablesData: {
        blockContainingPosition: Block;
        allBlocks: Block[];
    },
    prefixForSortText: string,
) {
    const { allBlocks, blockContainingPosition } = dynamicVariablesData;

    const variableReferences = getDynamicVariableReferences(
        requestData,
        blockContainingPosition,
        allBlocks,
    );

    return variableReferences
        .filter(
            // Filter out duplicate entries for the same variable name.
            ({ variableReference: { variableName } }, index) =>
                variableReferences.findIndex(
                    ({ variableReference: { variableName: n } }) =>
                        n == variableName,
                ) == index,
        )
        .map(
            ({
                blockName,
                variableReference: { variableName, referenceType },
            }) => {
                const completionItem = new CompletionItem({
                    label: variableName,
                    detail: `  Block '${blockName}'`,
                });
                completionItem.kind =
                    referenceType == VariableReferenceType.Read
                        ? CompletionItemKind.Field
                        : CompletionItemKind.Function;
                completionItem.sortText = `${prefixForSortText}_${blockName}_${variableName}`;
                return completionItem;
            },
        );
}

function mapStaticEnvVariables(
    matchingStaticEnvVariables: {
        environmentFile: string;
        matchingVariableKeys: string[];
        isConfiguredEnv: boolean;
    }[],
    functionType: VariableReferenceType,
    prefixForSortText: string,
) {
    return matchingStaticEnvVariables.flatMap(
        ({ environmentFile, matchingVariableKeys, isConfiguredEnv }) =>
            matchingVariableKeys.map((key) => {
                const environmentName = basename(
                    environmentFile,
                    getExtensionForBrunoFiles(),
                );
                const completionItem = new CompletionItem({
                    label: key,
                    description: `${functionType === VariableReferenceType.Set ? "!Env!" : "Env"} '${environmentName}'`,
                });
                completionItem.detail =
                    functionType == VariableReferenceType.Set
                        ? `WARNING: Will overwrite static environment variable from env '${environmentName}'`
                        : undefined;
                completionItem.kind = CompletionItemKind.Constant;
                completionItem.sortText = `${prefixForSortText}_${isConfiguredEnv ? "a" : "b"}_${environmentName}_${key}`;
                return completionItem;
            }),
    );
}

function getDynamicVariableReferences(
    requestData: {
        functionType: VariableReferenceType;
        requestPosition: VsCodePosition;
    },
    blockContainingPosition: Block,
    allBlocks: Block[],
) {
    const { functionType, requestPosition } = requestData;
    const relevantReferenceType =
        functionType == VariableReferenceType.Set
            ? VariableReferenceType.Read
            : VariableReferenceType.Set;
    const { otherRelevantBlocks, fromOwnBlock } =
        functionType == VariableReferenceType.Read
            ? getDynamicVariableReferencesForEarlierExecutionTimes(
                  requestPosition,
                  blockContainingPosition,
                  allBlocks,
                  VariableReferenceType.Set,
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
