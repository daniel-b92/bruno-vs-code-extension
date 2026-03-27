import {
    Block,
    VariableReferenceType,
    getFirstParameterForInbuiltFunctionIfStringLiteral,
    getInbuiltFunctionIdentifiers,
    getInbuiltFunctionReferenceType,
    getMatchingDefinitionsFromEnvFiles,
    EnvVariableNameMatchingMode,
    Logger,
    Position,
    CodeBlock,
    BrunoVariableType,
} from "@global_shared";
import { LanguageFeatureBaseRequest, TypedCollection } from "../../shared";
import { mapToEnvVarNameParams } from "../shared/mapToEnvVarNameParams";
import { CompletionItem } from "vscode-languageserver";
import { mapEnvVariablesToCompletions } from "./mapEnvVariablesToCompletions";
import { getDynamicVariableReferencesWithinFile } from "../shared/VariableReferences/getDynamicVariableReferencesWithinFile";
import { BlockRequestWithAdditionalData } from "../shared/interfaces";
import { getDynamicVariableReferencesFromOtherFiles } from "../shared/VariableReferences/getDynamicVariableReferencesFromOtherFiles";

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
                functionType: getInbuiltFunctionReferenceType(inbuiltFunction),
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
    const { position, token, filePath } = baseRequest;

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

    const dynamicVariableReferencesWithinFile =
        getDynamicVariableReferencesWithinFile(
            {
                request: baseRequest,
                file: { allBlocks, blockContainingPosition, collection },
                logger,
            },
            functionType,
            BrunoVariableType.Environment,
        );

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return [];
    }

    const dynamicVariableReferencesFromOtherFiles =
        getDynamicVariableReferencesFromOtherFiles(
            filePath,
            collection,
            functionType,
            BrunoVariableType.Environment,
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
            fromSameFile: dynamicVariableReferencesWithinFile,
            fromOtherFiles: dynamicVariableReferencesFromOtherFiles,
        },
        {
            collection,
            functionType,
            requestPosition: position,
            variable,
            token,
        },
    );
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        `Cancellation requested for completion provider for 'bru' language.`,
    );
}
