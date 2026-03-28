import {
    getFirstParameterForInbuiltFunctionIfStringLiteral,
    getInbuiltFunctionIdentifiers,
    getInbuiltFunctionReferenceType,
    getMatchingDefinitionsFromEnvFiles,
    EnvVariableNameMatchingMode,
    Logger,
    CodeBlock,
    BrunoVariableType,
    getInbuiltFunctionVariableType,
} from "@global_shared";
import { VariableSpecificRequestData } from "../../shared";
import { mapToVariableNameParams } from "../shared/mapToVariableNameParams";
import { CompletionItem } from "vscode-languageserver";
import { mapVariablesToCompletions } from "./mapVariablesToCompletions";
import { getDynamicVariableReferencesWithinFile } from "../shared/VariableReferences/getDynamicVariableReferencesWithinFile";
import { BlockRequestWithAdditionalData } from "../shared/interfaces";
import { getDynamicVariableReferencesFromOtherFiles } from "../shared/VariableReferences/getDynamicVariableReferencesFromOtherFiles";

export function getCompletionsForCodeBlock(
    fullRequest: BlockRequestWithAdditionalData<CodeBlock>,
    configuredEnvironment?: string,
): CompletionItem[] {
    const envVariableResult =
        getFirstParameterForInbuiltFunctionIfStringLiteral(
            mapToVariableNameParams(
                fullRequest,
                getInbuiltFunctionIdentifiers(),
            ),
        );

    if (envVariableResult) {
        const { inbuiltFunction, variable } = envVariableResult;

        return getResultsForVariable(
            fullRequest,
            {
                variable,
                functionType: getInbuiltFunctionReferenceType(inbuiltFunction),
                variableType: getInbuiltFunctionVariableType(inbuiltFunction),
            },
            configuredEnvironment,
        );
    }

    return [];
}

function getResultsForVariable(
    fullRequest: BlockRequestWithAdditionalData<CodeBlock>,
    { functionType, variableType, variable }: VariableSpecificRequestData,
    configuredEnvironment?: string,
) {
    const {
        file: { allBlocks, blockContainingPosition, collection },
        request: baseRequest,
        logger,
    } = fullRequest;
    const { token, filePath } = baseRequest;

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
            variableType,
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
            functionType,
            variableType,
            variable,
        },
    );
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        `Cancellation requested for completion provider for 'bru' language.`,
    );
}
