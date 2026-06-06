import {
    Block,
    BrunoFileType,
    BrunoVariableReference,
    BrunoVariableType,
    CodeBlock,
    getMatchingDefinitionsFromEnvFiles,
    ItemType,
    Logger,
    normalizePath,
    RequestFileBlockName,
    VariableNameMatchingMode,
} from "@global_shared";
import { BlockRequestWithAdditionalData } from "../interfaces";
import { getDynamicVariableReferencesWithinFile } from "./getDynamicVariableReferencesWithinFile";
import { getDynamicVariableReferencesFromOtherFiles } from "./getDynamicVariableReferencesFromOtherFiles";
import { getMatchingStaticScriptVariableReferences } from "./getMatchingStaticScriptVariableReferences";
import { filterDynamicReferences } from "./filterDynamicReferences";

export function getAllVariableReferences(
    fullRequest: BlockRequestWithAdditionalData<Block>,
    variableReference: BrunoVariableReference,
    environmentVarsParams: {
        configuredEnvironment?: string;
        matchingModeForEnvVars: VariableNameMatchingMode;
    },
) {
    const {
        file: { blockContainingPosition, collection },
        request: baseRequest,
        logger,
    } = fullRequest;
    const { token, filePath } = baseRequest;
    const { matchingModeForEnvVars, configuredEnvironment } =
        environmentVarsParams;
    const { variableName, referenceType, variableType } = variableReference;
    const isSourceBlockBlockForScriptVariables = (
        [
            RequestFileBlockName.PreRequestVars,
            RequestFileBlockName.PostResponseVars,
        ] as string[]
    ).includes(blockContainingPosition.name);

    if (isSourceBlockBlockForScriptVariables) {
        const scriptBlockToCheck = getScriptBlockForVariableBlock(
            blockContainingPosition.name as
                | RequestFileBlockName.PreRequestVars
                | RequestFileBlockName.PostResponseVars,
        );

        return getVariableRefsForScriptVarsBlock(
            scriptBlockToCheck,
            fullRequest,
            variableReference,
        );
    }

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

function getVariableRefsForScriptVarsBlock(
    blockToCheck:
        | RequestFileBlockName.PreRequestScript
        | RequestFileBlockName.PostResponseScript,
    {
        file: { allBlocks, collection },
        request: { filePath },
    }: BlockRequestWithAdditionalData<Block>,
    { variableType, referenceType }: BrunoVariableReference,
) {
    const itemType = collection
        .getStoredDataForPath(filePath)
        ?.item.getItemType();

    const refsWithinSameFile =
        allBlocks.find(({ name }) => name == blockToCheck)
            ?.variableReferences ?? [];

    if (
        !itemType ||
        !(
            [
                BrunoFileType.CollectionSettingsFile,
                BrunoFileType.FolderSettingsFile,
            ] as ItemType[]
        ).includes(itemType)
    ) {
        return [];
    }

    const ancestorFolderPath = normalizePath(filePath);
    const descendantItems = collection
        .getAllStoredDataForCollection()
        .filter(({ item }) => {
            const normalizedPath = normalizePath(item.getPath());
            return (
                normalizedPath.startsWith(ancestorFolderPath) &&
                normalizedPath.length > ancestorFolderPath.length
            );
        });

    const relevantRefsForDescendants = descendantItems
        .flatMap(
            ({ additionalData }) =>
                additionalData?.filter(({ block }) => block == blockToCheck) ??
                [],
        )
        .map(({ reference }) => reference);

    return filterDynamicReferences(
        refsWithinSameFile.concat(relevantRefsForDescendants),
        referenceType,
        variableType,
    );
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        `Cancellation requested for completion provider for 'bru' language.`,
    );
}

function getScriptBlockForVariableBlock(
    variableBlockName:
        | RequestFileBlockName.PreRequestVars
        | RequestFileBlockName.PostResponseVars,
) {
    return variableBlockName == RequestFileBlockName.PreRequestVars
        ? RequestFileBlockName.PreRequestScript
        : RequestFileBlockName.PostResponseScript;
}
