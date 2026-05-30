import {
    Block,
    BrunoVariableReference,
    BrunoVariableType,
    CodeBlock,
    getMatchingDefinitionsFromEnvFiles,
    Logger,
    RequestFileBlockName,
    VariableNameMatchingMode,
} from "@global_shared";
import { BlockRequestWithAdditionalData } from "../interfaces";
import { getDynamicVariableReferencesWithinFile } from "./getDynamicVariableReferencesWithinFile";
import { getDynamicVariableReferencesFromOtherFiles } from "./getDynamicVariableReferencesFromOtherFiles";
import { getMatchingStaticScriptVariableReferences } from "./getMatchingStaticScriptVariableReferences";

export function getAllVariableReferences(
    fullRequest: BlockRequestWithAdditionalData<Block>,
    { variableName, variableType, referenceType }: BrunoVariableReference,
    configuredEnvironment?: string,
    matchingModeForEnvVars = VariableNameMatchingMode.Ignore,
) {
    const {
        file: { blockContainingPosition, collection },
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
              matchingModeForEnvVars,
              configuredEnvironment,
          )
        : [];

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const matchingStaticScriptVariableDefinitions = (
        [
            RequestFileBlockName.PreRequestScript,
            RequestFileBlockName.PostResponseScript,
        ] as string[]
    ).includes(blockContainingPosition.name)
        ? getMatchingStaticScriptVariableReferences({
              ...fullRequest,
              file: {
                  ...fullRequest.file,
                  blockContainingPosition: fullRequest.file
                      .blockContainingPosition as CodeBlock,
              },
          })
        : [];

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const dynamicVariableReferencesWithinFile =
        getDynamicVariableReferencesWithinFile(
            fullRequest,
            referenceType,
            variableType,
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
        staticReferences: {
            fromEnvironmentFiles: matchingStaticEnvVariableDefinitions,
            fromScriptVariableBlocks: matchingStaticScriptVariableDefinitions,
        },
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
