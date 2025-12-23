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
    functionType: VariableReferenceType,
    requestPosition: VsCodePosition,
    dynamicVariablesData?: {
        blockContainingPosition: Block;
        allBlocks: Block[];
    },
) {
    return (
        dynamicVariablesData
            ? mapDynamicEnvVariables(
                  functionType,
                  requestPosition,
                  dynamicVariablesData,
                  "a",
              )
            : []
    ).concat(
        mapStaticEnvVariables(matchingStaticEnvVariables, functionType, "b"),
    );
}

function mapDynamicEnvVariables(
    functionType: VariableReferenceType,
    requestPosition: VsCodePosition,
    dynamicVariablesData: {
        blockContainingPosition: Block;
        allBlocks: Block[];
    },
    prefixForSortText: string,
) {
    const { allBlocks, blockContainingPosition } = dynamicVariablesData;

    const variableReferences =
        functionType == VariableReferenceType.Read
            ? getDynamicVariableReferencesForReadReferenceType(
                  blockContainingPosition,
                  allBlocks,
                  requestPosition,
              )
            : [];

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

function getDynamicVariableReferencesForReadReferenceType(
    blockContainingPosition: Block,
    allBlocks: Block[],
    requestPosition: VsCodePosition,
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

    if (
        blocksWithEarlierExecutionGroups.length == 0 &&
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
            blocksWithEarlierExecutionGroups.flatMap(
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
