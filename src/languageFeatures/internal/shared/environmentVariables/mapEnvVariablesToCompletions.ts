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
    ).concat(
        mapStaticEnvVariables(matchingStaticEnvVariables, functionType, "b"),
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

    return variableReferences.map(
        ({ blockName, variableReference: { variableName, referenceType } }) => {
            const completionItem = new CompletionItem({
                label: variableName,
                detail: `Block '${blockName}'`,
            });
            completionItem.kind =
                referenceType == VariableReferenceType.Read
                    ? CompletionItemKind.Field
                    : CompletionItemKind.Function;
            completionItem.sortText = `${prefixForSortText}_${variableName}`;
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
                    description: `${functionType === VariableReferenceType.Set ? "!Static variable in Env!" : "Env"} '${environmentName}'`,
                });
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
    const { otherRelevantBlocks, relevantReferencesInOwnBlock } =
        functionType == VariableReferenceType.Read
            ? getDynamicVariableReferencesForReadReferenceType(
                  requestPosition,
                  blockContainingPosition,
                  allBlocks,
              )
            : getDynamicVariableReferencesForSetReferenceType(
                  requestPosition,
                  blockContainingPosition,
                  allBlocks,
              );

    if (
        otherRelevantBlocks.length == 0 &&
        relevantReferencesInOwnBlock.length == 0
    ) {
        return [];
    }

    return relevantReferencesInOwnBlock
        .map((variableReference) => ({
            blockName: blockContainingPosition.name,
            variableReference,
        }))
        .concat(
            otherRelevantBlocks.flatMap(
                ({ name: blockName, variableReferences }) =>
                    variableReferences != undefined &&
                    variableReferences.length > 0
                        ? variableReferences.map((ref) => ({
                              blockName,
                              variableReference: ref,
                          }))
                        : [],
            ),
        )
        .filter(
            ({ variableReference: { variableType } }) =>
                variableType == BrunoVariableType.Unknown ||
                variableType == BrunoVariableType.Environment,
        );
}

function getDynamicVariableReferencesForReadReferenceType(
    requestPosition: VsCodePosition,
    blockContainingPosition: Block,
    allBlocks: Block[],
) {
    const blocksWithEarlierExecutionGroups =
        getBlocksWithEarlierExecutionGroups(
            blockContainingPosition.name,
            allBlocks,
        );

    const relevantReferencesInOwnBlock =
        isBlockCodeBlock(blockContainingPosition) &&
        blockContainingPosition.variableReferences != undefined
            ? blockContainingPosition.variableReferences.filter(
                  ({ referenceType, variableNameRange }) =>
                      referenceType == VariableReferenceType.Set &&
                      variableNameRange.end.isBefore(
                          mapFromVsCodePosition(requestPosition),
                      ),
              )
            : [];

    return {
        otherRelevantBlocks: blocksWithEarlierExecutionGroups,
        relevantReferencesInOwnBlock,
    };
}

function getDynamicVariableReferencesForSetReferenceType(
    requestPosition: VsCodePosition,
    blockContainingPosition: Block,
    allBlocks: Block[],
) {
    const blocksWithLaterExecutionGroups = getBlocksWithLaterExecutionGroups(
        blockContainingPosition.name,
        allBlocks,
    );

    const relevantReferencesInOwnBlock =
        isBlockCodeBlock(blockContainingPosition) &&
        blockContainingPosition.variableReferences != undefined
            ? blockContainingPosition.variableReferences.filter(
                  ({ referenceType, variableNameRange }) =>
                      referenceType == VariableReferenceType.Read &&
                      mapFromVsCodePosition(requestPosition).isBefore(
                          variableNameRange.start,
                      ),
              )
            : [];

    return {
        otherRelevantBlocks: blocksWithLaterExecutionGroups,
        relevantReferencesInOwnBlock,
    };
}
