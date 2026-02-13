import {
    Block,
    VariableReferenceType,
    getFirstParameterForInbuiltFunctionIfStringLiteral,
    getInbuiltFunctionIdentifiers,
    getInbuiltFunctionType,
    getMatchingDefinitionsFromEnvFiles,
    EnvVariableNameMatchingMode,
    Logger,
} from "@global_shared";
import {
    CodeBlockRequestWithAdditionalData,
    LanguageFeatureBaseRequest,
    mapEnvVariablesToCompletions,
    TypedCollection,
} from "../../shared";
import { mapToEnvVarNameParams } from "../shared/mapToEnvVarNameParams";
import { CompletionItem } from "vscode-languageserver";

export function getCompletionsForCodeBlock(
    fullRequest: CodeBlockRequestWithAdditionalData,
    configuredEnvironment?: string,
): CompletionItem[] {
    const {
        request,
        file: { blockContainingPosition, allBlocks, collection },
        logger,
    } = fullRequest;

    const envVariableResult =
        getFirstParameterForInbuiltFunctionIfStringLiteral(
            mapToEnvVarNameParams(fullRequest, getInbuiltFunctionIdentifiers()),
        );

    if (envVariableResult) {
        const { inbuiltFunction, variableName } = envVariableResult;

        return getResultsForEnvironmentVariable(
            variableName,
            {
                collection,
                functionType: getInbuiltFunctionType(inbuiltFunction),
                blockContainingPosition,
                allBlocks,
                configuredEnvironment,
            },
            request,
            logger,
        );
    }

    return [];
}

function getResultsForEnvironmentVariable(
    variableName: string,
    additionalData: {
        collection: TypedCollection;
        functionType: VariableReferenceType;
        blockContainingPosition: Block;
        allBlocks: Block[];
        configuredEnvironment?: string;
    },
    { position, token }: LanguageFeatureBaseRequest,
    logger?: Logger,
) {
    const {
        collection,
        functionType,
        allBlocks,
        blockContainingPosition,
        configuredEnvironment,
    } = additionalData;

    const matchingStaticEnvVariableDefinitions =
        getMatchingDefinitionsFromEnvFiles(
            collection,
            variableName,
            EnvVariableNameMatchingMode.Ignore,
            configuredEnvironment,
        );

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return [];
    }

    return mapEnvVariablesToCompletions(
        matchingStaticEnvVariableDefinitions.map(
            ({ file, matchingVariables, isConfiguredEnv }) => ({
                environmentFile: file,
                matchingVariableKeys: matchingVariables.map(({ key }) => key),
                isConfiguredEnv,
            }),
        ),
        {
            requestData: {
                collection,
                functionType,
                requestPosition: position,
                variableName,
                token,
            },
            bruFileSpecificData: { allBlocks, blockContainingPosition },
            logger,
        },
    );
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        `Cancellation requested for completion provider for 'bru' language.`,
    );
}
