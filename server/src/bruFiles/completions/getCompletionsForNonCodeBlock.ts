import {
    Block,
    BrunoVariableType,
    EnvVariableNameMatchingMode,
    getBlocksWithoutVariableSupport,
    getMatchingDefinitionsFromEnvFiles,
    getMatchingTextContainingPosition,
    getPossibleMethodBlocks,
    isAuthBlock,
    isBrunoFileType,
    Logger,
    Position,
    RequestFileBlockName,
    SettingsFileSpecificBlock,
    VariableReferenceType,
} from "@global_shared";
import { CompletionItem } from "vscode-languageserver";
import {
    LanguageFeatureBaseRequest,
    TypedCollection,
    TypedCollectionItemProvider,
} from "../../shared";
import { BlockRequestWithAdditionalData } from "../shared/interfaces";
import { mapVariablesToCompletions } from "./mapVariablesToCompletions";
import { getDynamicVariableReferencesWithinFile } from "../shared/VariableReferences/getDynamicVariableReferencesWithinFile";
import { getDynamicVariableReferencesFromOtherFiles } from "../shared/VariableReferences/getDynamicVariableReferencesFromOtherFiles";
import { getMetaBlockContentCompletions } from "./dictionaryBlocks/specificBlocks/getMetaBlockContentCompletions";
import { getMethodBlockContentCompletions } from "./dictionaryBlocks/specificBlocks/getMethodBlockContentCompletions";
import { getAuthBlockContentCompletions } from "./dictionaryBlocks/specificBlocks/getAuthBlockContentCompletions";
import { getSettingsBlockContentCompletions } from "./dictionaryBlocks/specificBlocks/getSettingsBlockContentCompletions";
import { getAuthModeBlockContentCompletions } from "./dictionaryBlocks/specificBlocks/getAuthModeBlockContentCompletions";

export async function getCompletionsForNonCodeBlock(
    fullRequest: BlockRequestWithAdditionalData<Block>,
    itemProvider: TypedCollectionItemProvider,
    configuredEnvironment?: string,
): Promise<CompletionItem[] | undefined> {
    const {
        request: baseRequest,
        file: { blockContainingPosition, allBlocks, collection },
    } = fullRequest;

    return (
        (await getBlockSpecificCompletions(
            itemProvider,
            baseRequest,
            allBlocks,
            blockContainingPosition,
            collection,
        )) ?? []
    ).concat(
        collection
            ? getNonBlockSpecificCompletions(fullRequest, configuredEnvironment)
            : [],
    );
}

function getNonBlockSpecificCompletions(
    fullRequest: BlockRequestWithAdditionalData<Block>,
    configuredEnvironment?: string,
) {
    const {
        request,
        file: { blockContainingPosition, collection },
        logger,
    } = fullRequest;
    const { documentHelper, position, token, filePath } = request;
    const { line } = position;
    // In non-code blocks, variables cannot be set.
    const functionType = VariableReferenceType.Read;
    // In non-code blocks, all kinds of variables can be used via the same syntax.
    const variableType = BrunoVariableType.Unknown;
    const lineContent = documentHelper.getLineByIndex(line);

    if (
        (getBlocksWithoutVariableSupport() as string[]).includes(
            blockContainingPosition.name,
        )
    ) {
        return [];
    }
    const variableParsingResult = getVariable(request, lineContent, logger);
    if (!variableParsingResult) {
        return [];
    }

    const { variable, toAppendOnInsertion } = variableParsingResult;

    const matchingStaticEnvVariableDefinitions = [
        BrunoVariableType.Environment,
        BrunoVariableType.Unknown,
    ].includes(variableType)
        ? getMatchingDefinitionsFromEnvFiles(
              collection,
              variable.name,
              EnvVariableNameMatchingMode.Ignore,
              configuredEnvironment,
          )
        : [];

    if (matchingStaticEnvVariableDefinitions.length == 0) {
        return [];
    }

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return [];
    }

    const dynamicVariableReferencesWithinFile =
        getDynamicVariableReferencesWithinFile(fullRequest, functionType);

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return [];
    }

    const dynamicVariableReferencesFromOtherFiles =
        getDynamicVariableReferencesFromOtherFiles(
            filePath,
            collection,
            functionType,
            variableType,
        );

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return [];
    }

    return mapVariablesToCompletions(
        matchingStaticEnvVariableDefinitions.map(
            ({ file, matchingVariables, isConfiguredEnv }) => ({
                environmentFile: file,
                matchingVariableKeys: matchingVariables.map(({ key }) => key),
                isConfiguredEnv,
            }),
        ),
        {
            fromSameFile: dynamicVariableReferencesWithinFile,
            fromOtherFiles: dynamicVariableReferencesFromOtherFiles,
        },
        {
            variable,
            functionType,
            variableType,
        },
        toAppendOnInsertion,
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
