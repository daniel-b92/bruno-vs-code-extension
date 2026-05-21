import {
    getMatchingDefinitionsFromEnvFiles,
    EnvVariableNameMatchingMode,
    Logger,
    CodeBlock,
    BrunoVariableType,
    BrunoVariableReference,
} from "@global_shared";
import { CompletionItem } from "vscode-languageserver";
import { mapVariablesToCompletions } from "./mapVariablesToCompletions";
import { getDynamicVariableReferencesWithinFile } from "../shared/VariableReferences/getDynamicVariableReferencesWithinFile";
import { BlockRequestWithAdditionalData } from "../shared/interfaces";
import { getDynamicVariableReferencesFromOtherFiles } from "../shared/VariableReferences/getDynamicVariableReferencesFromOtherFiles";

export function getCompletionsForCodeBlock(
    fullRequest: BlockRequestWithAdditionalData<CodeBlock>,
    configuredEnvironment?: string,
): CompletionItem[] {
    const {
        request: { position },
        file: { blockContainingPosition },
    } = fullRequest;

    const variableReference = blockContainingPosition.variableReferences?.find(
        ({ variableNameRange }) => variableNameRange.contains(position),
    );

    if (variableReference) {
        return getResultsForVariable(
            fullRequest,
            variableReference,
            configuredEnvironment,
        );
    }

    return [];
}

function getResultsForVariable(
    fullRequest: BlockRequestWithAdditionalData<CodeBlock>,
    {
        referenceType,
        variableType,
        variableName,
        variableNameRange,
    }: BrunoVariableReference,
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
              variableName,
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
            referenceType,
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
            referenceType,
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
            functionType: referenceType,
            variableType,
            variable: { name: variableName, ...variableNameRange },
        },
    );
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        `Cancellation requested for completion provider for 'bru' language.`,
    );
}
