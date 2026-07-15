import {
    Block,
    BrunoVariableType,
    getBlocksWithoutVariableSupport,
    getMatchingTextContainingPosition,
    getPossibleMethodBlocks,
    isAuthBlock,
    isBrunoFileType,
    Logger,
    Position,
    RequestFileBlockName,
    SettingsFileSpecificBlock,
    VariableReferenceType,
    getActiveKeysUsedInOtherLines,
    getKeyRangeContainingPosition,
    LineBreakType,
    Range,
} from "@global_shared";
import { CompletionItem } from "vscode-languageserver";
import {
    LanguageFeatureBaseRequest,
    TypedCollection,
    TypedCollectionItemProvider,
} from "../../shared";
import { BlockRequestWithAdditionalData } from "../shared/interfaces";
import { mapVariablesToCompletions } from "./mapVariablesToCompletions";
import { getMetaBlockContentCompletions } from "./dictionaryBlocks/specificBlocks/getMetaBlockContentCompletions";
import { getMethodBlockContentCompletions } from "./dictionaryBlocks/specificBlocks/getMethodBlockContentCompletions";
import { getAuthBlockContentCompletions } from "./dictionaryBlocks/specificBlocks/getAuthBlockContentCompletions";
import { getSettingsBlockContentCompletions } from "./dictionaryBlocks/specificBlocks/getSettingsBlockContentCompletions";
import { getAuthModeBlockContentCompletions } from "./dictionaryBlocks/specificBlocks/getAuthModeBlockContentCompletions";
import { getAllVariableReferences } from "../shared/VariableReferences/getAllVariableReferences";
import { getTextEditForKey } from "./dictionaryBlocks/generic/getTextEditForKey";

export async function getCompletionsForNonCodeBlock(
    fullRequest: BlockRequestWithAdditionalData<Block>,
    itemProvider: TypedCollectionItemProvider,
    configuredEnvironment?: string,
): Promise<CompletionItem[] | undefined> {
    const {
        request: baseRequest,
        file: { blockContainingPosition, allBlocks, collection },
    } = fullRequest;

    if (
        (getBlocksWithoutVariableSupport() as string[]).includes(
            blockContainingPosition.name,
        )
    ) {
        return [];
    }

    return (
        (await getBlockSpecificCompletions(
            itemProvider,
            baseRequest,
            allBlocks,
            blockContainingPosition,
            collection,
        )) ?? []
    ).concat(
        // For Script variable blocks only write-only variables can be defined.
        (
            [
                RequestFileBlockName.PreRequestVars,
                RequestFileBlockName.PostResponseVars,
            ] as string[]
        ).includes(blockContainingPosition.name)
            ? getCompletionsForBlockWithWriteOnlyVariables(
                  fullRequest,
                  configuredEnvironment,
              )
            : getCompletionsForBlockWithReadOnlyVariables(
                  fullRequest,
                  configuredEnvironment,
              ),
    );
}

function getCompletionsForBlockWithReadOnlyVariables(
    fullRequest: BlockRequestWithAdditionalData<Block>,
    configuredEnvironment?: string,
) {
    const { request, logger } = fullRequest;
    const { documentHelper, position } = request;
    const { line } = position;
    const functionType = VariableReferenceType.Read;
    // In non-code blocks, all kinds of variables can be accessed via reading with the same syntax.
    const variableType = BrunoVariableType.Unknown;
    const lineContent = documentHelper.getLineByIndex(line);

    const variableParsingResult = getVariable(request, lineContent, logger);
    if (!variableParsingResult) {
        return [];
    }

    const { variable, toAppendOnInsertion } = variableParsingResult;

    const allRefs = getAllVariableReferences(
        fullRequest,
        {
            referenceType: functionType,
            variableType,
        },
        {
            configuredEnvironment,
        },
    );

    if (!allRefs) {
        return [];
    }

    const {
        staticReferences: { fromEnvironmentFiles },
        dynamicReferences: { withinSameFile, fromOtherFiles },
    } = allRefs;

    return mapVariablesToCompletions(
        {
            staticEnvVariables: fromEnvironmentFiles.map(
                ({ file, matchingVariables, isConfiguredEnv }) => ({
                    environmentFile: file,
                    matchingVariableKeys: matchingVariables.map(
                        ({ key }) => key,
                    ),
                    isConfiguredEnv,
                }),
            ),
            dynamicVariables: {
                fromSameFile: withinSameFile,
                fromOtherFiles,
            },
        },
        {
            variable,
            functionType,
            variableType,
            documentLineBreak:
                documentHelper.getMostUsedLineBreak() ?? LineBreakType.Lf,
        },
        toAppendOnInsertion,
    );
}

function getCompletionsForBlockWithWriteOnlyVariables(
    fullRequest: BlockRequestWithAdditionalData<Block>,
    configuredEnvironment?: string,
) {
    const {
        request: { documentHelper, position },
        file: { blockContainingPosition: block },
    } = fullRequest;
    const functionType = VariableReferenceType.Write;
    const variableType = BrunoVariableType.Simple;

    const allRefs = getAllVariableReferences(
        fullRequest,
        {
            referenceType: functionType,
            variableType,
        },
        {
            configuredEnvironment,
        },
    );

    if (!allRefs) {
        return [];
    }

    const activeKeysInOtherLines = getActiveKeysUsedInOtherLines(
        position.line,
        block,
    );
    const variableRange = getKeyRangeContainingPosition(position, block);

    const nonDuplicateRefsFromOtherFiles =
        // For Script variable blocks, the only relevant references can be in code blocks, which means dynamic references.
        allRefs.dynamicReferences.fromOtherFiles.filter(
            ({
                mostRelevantReference: {
                    reference: { variableName },
                },
            }) => !activeKeysInOtherLines.includes(variableName),
        );
    const nonDuplicateRefsFromSameFile =
        // For Script variable blocks, the only relevant references can be in code blocks, which means dynamic references.
        allRefs.dynamicReferences.withinSameFile.filter(
            ({ variableReference: { variableName } }) =>
                !activeKeysInOtherLines.includes(variableName),
        );

    return !variableRange
        ? []
        : mapVariablesToCompletions(
              {
                  staticEnvVariables: [],
                  staticScriptVariables: [],
                  dynamicVariables: {
                      fromSameFile: nonDuplicateRefsFromSameFile,
                      fromOtherFiles: nonDuplicateRefsFromOtherFiles,
                  },
              },
              {
                  variable: {
                      ...variableRange,
                      name: documentHelper.getText(variableRange),
                  },
                  functionType,
                  variableType,
                  documentLineBreak:
                      documentHelper.getMostUsedLineBreak() ?? LineBreakType.Lf,
              },
              undefined,
              (
                  variableName: string,
                  rangeToReplace: Range,
                  lineBreak: LineBreakType,
              ) =>
                  getTextEditForKey(
                      lineBreak,
                      rangeToReplace,
                      variableName,
                      true,
                  ),
          );
}

async function getBlockSpecificCompletions(
    itemProvider: TypedCollectionItemProvider,
    request: LanguageFeatureBaseRequest,
    allBlocks: Block[],
    blockContainingPosition: Block,
    collection?: TypedCollection,
) {
    const { name: blockName } = blockContainingPosition;
    const itemType = collection
        ? collection.getStoredDataForPath(request.filePath)?.item.getItemType()
        : undefined;

    if (
        blockName == RequestFileBlockName.Meta &&
        itemType &&
        isBrunoFileType(itemType)
    ) {
        return await getMetaBlockContentCompletions(
            itemProvider,
            request,
            blockContainingPosition,
            itemType,
            collection,
        );
    }
    if ((getPossibleMethodBlocks() as string[]).includes(blockName)) {
        return getMethodBlockContentCompletions(
            request,
            allBlocks,
            blockContainingPosition,
        );
    }
    if (isAuthBlock(blockName)) {
        return getAuthBlockContentCompletions(request, blockContainingPosition);
    }
    if (blockName == RequestFileBlockName.Settings) {
        return getSettingsBlockContentCompletions(
            request,
            blockContainingPosition,
        );
    }
    if (blockName == SettingsFileSpecificBlock.AuthMode) {
        return getAuthModeBlockContentCompletions(
            request,
            allBlocks,
            blockContainingPosition,
        );
    }
    return [];
}

function getVariable(
    { position, token }: LanguageFeatureBaseRequest,
    lineContent: string,
    logger?: Logger,
) {
    const { character, line } = position;
    const matchingTextResult = getMatchingTextContainingPosition(
        position,
        lineContent,
        /{{[^{}\s]*/,
    );

    if (!matchingTextResult) {
        return undefined;
    }

    const {
        text: matchingText,
        startChar,
        endChar: endCharForMatchingText,
    } = matchingTextResult;
    // If the position is not after both starting brackets, provided completions would be inserted in an invalid location.
    if (character < startChar + 2 || character > endCharForMatchingText) {
        return undefined;
    }

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    // Avoid overwriting content that may not be directly related to the variable.
    const endCharForInsertion = Math.min(
        endCharForMatchingText,
        position.character,
    );

    return {
        variable: {
            name: matchingText.substring(2),
            start: new Position(line, startChar + 2),
            end: new Position(line, endCharForInsertion),
        },
        toAppendOnInsertion: !lineContent
            .substring(endCharForInsertion)
            .startsWith("}")
            ? "}}"
            : "",
    };
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        `Cancellation requested for completion provider for bruno language.`,
    );
}
