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
    VariableReferenceType,
} from "@global_shared";
import {
    BlockRequestWithAdditionalData,
    VariableReferenceFromOtherFile,
} from "../interfaces";
import { getDynamicVariableReferencesWithinFile } from "./getDynamicVariableReferencesWithinFile";
import { getDynamicVariableReferencesFromOtherFiles } from "./getDynamicVariableReferencesFromOtherFiles";
import { getMatchingStaticScriptVariableReferences } from "./getMatchingStaticScriptVariableReferences";
import { filterDynamicReferences } from "./filterDynamicReferences";
import { dirname, relative } from "path";
import { areReferencesEquivalentForLanguageFeatures } from "./areReferencesEquivalentForLanguageFeatures";

export function getAllVariableReferences(
    fullRequest: BlockRequestWithAdditionalData<Block>,
    sourceReference: {
        referenceType: VariableReferenceType;
        variableType: BrunoVariableType;
    },
    environmentVarsParams: {
        configuredEnvironment?: string;
        variableNameForFiltering?: string;
    },
) {
    const {
        file: { blockContainingPosition, collection },
        request: baseRequest,
        logger,
    } = fullRequest;
    const { token, filePath } = baseRequest;
    const { variableNameForFiltering, configuredEnvironment } =
        environmentVarsParams;
    const { referenceType, variableType } = sourceReference;
    const isSourceBlockBlockForScriptVariables = (
        [
            RequestFileBlockName.PreRequestVars,
            RequestFileBlockName.PostResponseVars,
        ] as string[]
    ).includes(blockContainingPosition.name);

    if (isSourceBlockBlockForScriptVariables) {
        // In script vars blocks, variables can only be set, not read.
        // So the only relevant variable references are in the blocks that can read the variables that are set within the source block.
        const scriptBlockToCheck = getScriptBlockForVariableBlock(
            blockContainingPosition.name as
                | RequestFileBlockName.PreRequestVars
                | RequestFileBlockName.PostResponseVars,
        );

        const refs = getVariableRefsForScriptVarsBlock(
            scriptBlockToCheck,
            fullRequest,
            sourceReference,
        );

        if (refs == undefined) {
            return undefined;
        }

        const { withinSameFile, fromOtherFiles } = refs;

        return {
            staticReferences: {
                fromEnvironmentFiles: [],
                fromScriptVariableBlocks: [],
            },
            dynamicReferences: {
                withinSameFile,
                fromOtherFiles:
                    groupReferencesWithSameRelevance(fromOtherFiles),
            },
        };
    }

    const matchingStaticEnvVariableDefinitions = [
        BrunoVariableType.Environment,
        BrunoVariableType.Unknown,
    ].includes(variableType)
        ? getMatchingDefinitionsFromEnvFiles(
              collection,
              variableNameForFiltering,
              configuredEnvironment,
          )
        : [];

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const matchingStaticScriptVariableDefinitions = [
        BrunoVariableType.Folder,
        BrunoVariableType.Request,
    ].includes(variableType)
        ? getMatchingStaticScriptVariableReferences(
              {
                  ...fullRequest,
                  file: {
                      ...fullRequest.file,
                      blockContainingPosition: fullRequest.file
                          .blockContainingPosition as CodeBlock,
                  },
              },
              variableType,
          )
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
    sourceReference: {
        referenceType: VariableReferenceType;
    },
):
    | {
          withinSameFile: {
              blockName: string;
              variableReference: BrunoVariableReference;
          }[];
          fromOtherFiles: VariableReferenceFromOtherFile[];
      }
    | undefined {
    const { referenceType } = sourceReference;
    const itemType = collection
        .getStoredDataForPath(filePath)
        ?.item.getItemType();

    if (
        !itemType ||
        // Script blocks and script vars blocks are only valid for certain file types.
        !(
            [
                BrunoFileType.CollectionSettingsFile,
                BrunoFileType.FolderSettingsFile,
                BrunoFileType.RequestFile,
            ] as ItemType[]
        ).includes(itemType)
    ) {
        return undefined;
    }
    const variableType =
        itemType == BrunoFileType.RequestFile
            ? BrunoVariableType.Request
            : BrunoVariableType.Folder;

    const refsWithinSameFile =
        allBlocks.find(({ name }) => name == blockToCheck)
            ?.variableReferences ?? [];

    if (itemType == BrunoFileType.RequestFile) {
        // Request files cannot have any descendant collection items.
        return {
            withinSameFile: filterDynamicReferences(
                refsWithinSameFile,
                referenceType,
                variableType,
            ).map((ref) => ({
                blockName: blockToCheck,
                variableReference: ref,
            })),
            fromOtherFiles: [],
        };
    }

    const ancestorFolderPath = normalizePath(dirname(filePath));
    const descendantItems = collection
        .getAllStoredDataForCollection()
        .filter(({ item }) => {
            const normalizedPath = normalizePath(item.getPath());
            return (
                normalizedPath.startsWith(ancestorFolderPath) &&
                normalizedPath.length > ancestorFolderPath.length
            );
        });

    const relevantRefsForDescendants = descendantItems.flatMap(
        ({ item, additionalData }) => {
            const refsInRelevantBlock = additionalData?.filter(
                ({ block }) => block == blockToCheck,
            );
            return !refsInRelevantBlock || refsInRelevantBlock.length == 0
                ? []
                : refsInRelevantBlock.map(({ reference }) => ({
                      path: item.getPath(),
                      reference,
                  }));
        },
    );

    return {
        withinSameFile: filterDynamicReferences(
            refsWithinSameFile,
            referenceType,
            variableType,
        ).map((ref) => ({ blockName: blockToCheck, variableReference: ref })),
        fromOtherFiles: relevantRefsForDescendants.flatMap(
            ({ path, reference }) => {
                const relevantRefs = filterDynamicReferences(
                    [reference],
                    referenceType,
                    variableType,
                );
                return relevantRefs.length == 0
                    ? []
                    : [
                          {
                              path: {
                                  absolute: path,
                                  relativeToSourceFile: relative(
                                      filePath,
                                      path,
                                  ),
                              },
                              indirectionLevel: 1,
                              reference,
                          },
                      ];
            },
        ),
    };
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        `Cancellation requested while searching for variable references.`,
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

function groupReferencesWithSameRelevance(
    references: VariableReferenceFromOtherFile[],
) {
    return references.reduce(
        (prev, curr) => {
            const matchingReferenceIndex = prev.findIndex(
                ({ mostRelevantReference: { reference: registered } }) =>
                    areReferencesEquivalentForLanguageFeatures(
                        curr.reference,
                        registered,
                    ),
            );

            return matchingReferenceIndex < 0
                ? prev.concat({
                      mostRelevantReference: curr,
                      otherMatchingReferences: [],
                  })
                : prev.map((entry, index) =>
                      index != matchingReferenceIndex
                          ? entry
                          : {
                                mostRelevantReference:
                                    entry.mostRelevantReference,
                                otherMatchingReferences:
                                    entry.otherMatchingReferences.concat(curr),
                            },
                  );
        },
        [] as {
            mostRelevantReference: VariableReferenceFromOtherFile;
            otherMatchingReferences: VariableReferenceFromOtherFile[];
        }[],
    );
}
