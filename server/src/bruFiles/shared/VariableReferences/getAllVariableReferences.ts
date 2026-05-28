import {
    Block,
    BrunoVariableReference,
    BrunoVariableType,
    CodeBlock,
    getMatchingDefinitionsFromEnvFiles,
    Logger,
    RequestFileBlockName,
    VariableAvailabilityScopes,
    VariableNameMatchingMode,
    VariableReferenceType,
} from "@global_shared";
import {
    BlockRequestWithAdditionalData,
    EquivalentVariableReferencesFromOtherFiles,
    VariableReferenceFromOtherFile,
} from "../interfaces";
import { getDynamicVariableReferencesWithinFile } from "./getDynamicVariableReferencesWithinFile";
import { getDynamicVariableReferencesFromOtherFiles } from "./getDynamicVariableReferencesFromOtherFiles";
import { isDynamicVariableReference } from "./isDynamicVariableReference";
import { areReferencesEquivalentForLanguageFeatures } from "./areReferencesEquivalentForLanguageFeatures";
import { relative } from "path";

export function getAllVariableReferences(
    fullRequest: BlockRequestWithAdditionalData<Block>,
    { variableName, variableType, referenceType }: BrunoVariableReference,
    configuredEnvironment?: string,
    matchingModeForEnvVars = VariableNameMatchingMode.Ignore,
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

function getMatchingStaticScriptVariableReferences({
    file: { blockContainingPosition, collection },
    request: { filePath },
}: BlockRequestWithAdditionalData<CodeBlock>): EquivalentVariableReferencesFromOtherFiles[] {
    const relevantScope =
        blockContainingPosition.name == RequestFileBlockName.PreRequestScript
            ? VariableAvailabilityScopes.PreRequestScriptForOwnItemAndDescendants
            : VariableAvailabilityScopes.PostResponseScriptForOwnItemAndDescendants;

    const relevantReferences = collection
        .getCommonAncestorData(filePath)
        .filter(({ additionalData }) => additionalData != undefined)
        .map(({ item, additionalData }) => ({
            path: item.getPath(),
            references: (additionalData as BrunoVariableReference[]).filter(
                ({ referenceType, scope }) =>
                    !isDynamicVariableReference(scope) &&
                    referenceType == VariableReferenceType.Write &&
                    scope == relevantScope,
            ),
        }))
        // Sort paths descending by length
        .sort(({ path: path1 }, { path: path2 }) => path2.length - path1.length)
        .map((data, index) => ({ ...data, indirectionLevel: index }));

    return groupReferences(filePath, relevantReferences);
}

function groupReferences(
    sourceFilePath: string,
    allReferences: {
        path: string;
        references: BrunoVariableReference[];
        indirectionLevel: number;
    }[],
) {
    return allReferences
        .flatMap(({ path: absolutePath, indirectionLevel, references }) =>
            references.map((reference) => ({
                path: {
                    absolute: absolutePath,
                    relativeToSourceFile: relative(
                        sourceFilePath,
                        absolutePath,
                    ),
                },
                indirectionLevel,
                reference,
            })),
        )
        .reduce(
            (prev, curr) => {
                const matchingReferenceIndex = prev.findIndex(
                    ({ mostRelevantReference: { reference: registered } }) =>
                        areReferencesEquivalentForLanguageFeatures(
                            curr.reference,
                            registered,
                        ),
                );

                if (matchingReferenceIndex < 0) {
                    return prev.concat({
                        mostRelevantReference: curr,
                        otherMatchingReferences: [],
                    });
                }

                const mostRelevantSoFar =
                    prev[matchingReferenceIndex].mostRelevantReference;

                if (
                    curr.indirectionLevel < mostRelevantSoFar.indirectionLevel
                ) {
                    return prev.map((entry, index) =>
                        index != matchingReferenceIndex
                            ? entry
                            : {
                                  mostRelevantReference: curr,
                                  otherMatchingReferences:
                                      entry.otherMatchingReferences.concat(
                                          mostRelevantSoFar,
                                      ),
                              },
                    );
                }

                return prev.map((entry, index) =>
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

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        `Cancellation requested for completion provider for 'bru' language.`,
    );
}
