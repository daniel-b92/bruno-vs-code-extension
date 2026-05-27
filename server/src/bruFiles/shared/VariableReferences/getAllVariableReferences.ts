import {
    Block,
    BrunoVariableReference,
    BrunoVariableType,
    getMatchingDefinitionsFromEnvFiles,
    Logger,
    VariableNameMatchingMode,
} from "@global_shared";
import { BlockRequestWithAdditionalData } from "../interfaces";
import { getDynamicVariableReferencesWithinFile } from "./getDynamicVariableReferencesWithinFile";
import { getDynamicVariableReferencesFromOtherFiles } from "./getDynamicVariableReferencesFromOtherFiles";

export function getAllVariableReferences(
    {
        file: { allBlocks, blockContainingPosition, collection },
        request: baseRequest,
        logger,
    }: BlockRequestWithAdditionalData<Block>,
    { variableName, variableType, referenceType }: BrunoVariableReference,
    configuredEnvironment?: string,
    matchingModeForEnvVars = VariableNameMatchingMode.Ignore,
) {
    const { token, filePath } = baseRequest;

    const matchingStaticEnvVariableDefinitions = [
        BrunoVariableType.Environment,
        BrunoVariableType.Unknown,
    ].includes(variableType)
        ? getMatchingDefinitionsFromEnvFiles(
              collection,
              variableName,
              matchingModeForEnvVars,
              configuredEnvironment,
          )
        : [];

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const dynamicVariableReferencesWithinFile =
        getDynamicVariableReferencesWithinFile(
            {
                request: baseRequest,
                file: { allBlocks, blockContainingPosition, collection },
                logger,
            },
            referenceType,
        );

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const dynamicVariableReferencesFromOtherFiles =
        getDynamicVariableReferencesFromOtherFiles(
            filePath,
            collection,
            referenceType,
            variableType,
        );

    return {
        staticReferences: matchingStaticEnvVariableDefinitions,
        dynamicReferences: {
            withinSameFile: dynamicVariableReferencesWithinFile,
            fromOtherFiles: dynamicVariableReferencesFromOtherFiles,
        },
    };
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        `Cancellation requested for completion provider for 'bru' language.`,
    );
}
