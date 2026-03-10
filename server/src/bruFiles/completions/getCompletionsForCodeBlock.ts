import {
    Block,
    VariableReferenceType,
    getFirstParameterForInbuiltFunctionIfStringLiteral,
    getInbuiltFunctionIdentifiers,
    getInbuiltFunctionType,
    getMatchingDefinitionsFromEnvFiles,
    EnvVariableNameMatchingMode,
    Logger,
    Position,
    CodeBlock,
} from "@global_shared";
import { LanguageFeatureBaseRequest, TypedCollection } from "../../shared";
import { mapToEnvVarNameParams } from "../shared/mapToEnvVarNameParams";
import { CompletionItem } from "vscode-languageserver";
import { mapEnvVariablesToCompletions } from "./mapEnvVariablesToCompletions";
import { getDynamicVariableReferences } from "../shared/getDynamicVariableReferences";
import { BlockRequestWithAdditionalData } from "../shared/interfaces";

export function getCompletionsForCodeBlock(
    fullRequest: BlockRequestWithAdditionalData<CodeBlock>,
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
        const { inbuiltFunction, variable } = envVariableResult;

        return getResultsForEnvironmentVariable(
            variable,
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
    variable: {
        name: string;
        start: Position;
        end: Position;
    },
    additionalData: {
        collection: TypedCollection;
        functionType: VariableReferenceType;
        blockContainingPosition: Block;
        allBlocks: Block[];
        configuredEnvironment?: string;
    },
    baseRequest: LanguageFeatureBaseRequest,
    logger?: Logger,
) {
    const {
        collection,
        functionType,
        allBlocks,
        blockContainingPosition,
        configuredEnvironment,
    } = additionalData;
    const { position, token } = baseRequest;

    const matchingStaticEnvVariableDefinitions =
        getMatchingDefinitionsFromEnvFiles(
            collection,
            variable.name,
            EnvVariableNameMatchingMode.Ignore,
            configuredEnvironment,
        );

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return [];
    }

    const dynamicVariableReferences = getDynamicVariableReferences(
        {
            request: baseRequest,
            file: { allBlocks, blockContainingPosition, collection },
            logger,
        },
        functionType,
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
        dynamicVariableReferences,
        {
            requestData: {
                collection,
                functionType,
                requestPosition: position,
                variable,
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
