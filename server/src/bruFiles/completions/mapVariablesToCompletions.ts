import {
    VariableReferenceType,
    Range,
    Position,
    VariableAvailabilityScopes,
    RequestFileBlockName,
} from "@global_shared";
import {
    VariableSpecificRequestData,
    groupReferencesByName,
    mapStaticEnvVariablesToCompletions,
    ReferenceFromOwnFileDetails,
} from "../../shared";
import {
    CompletionItem,
    CompletionItemKind,
    TextEdit,
} from "vscode-languageserver";
import {
    EquivalentVariableReferencesFromOtherFiles,
    MatchingDynamicVariables,
} from "../shared/interfaces";

export function mapVariablesToCompletions(
    matchingReferences: {
        staticEnvVariables: {
            environmentFile: string;
            matchingVariableKeys: string[];
            isConfiguredEnv: boolean;
        }[];
        staticScriptVariables?: EquivalentVariableReferencesFromOtherFiles[];
        dynamicVariables: MatchingDynamicVariables;
    },
    requestData: VariableSpecificRequestData,
    appendOnInsertion?: string,
) {
    const { staticEnvVariables, staticScriptVariables, dynamicVariables } =
        matchingReferences;
    const resultsForDynamicVariables = mapDynamicVariables(
        requestData,
        dynamicVariables,
        {
            prefixForSortText: "a",
            appendOnInsertion,
        },
    );

    const resultsForStaticScriptVariables = staticScriptVariables
        ? mapStaticScriptVariables(requestData, staticScriptVariables, {
              // Display static script variables below dynamic ones, but above static environment variables.
              prefixForSortText: "b",
              appendOnInsertion,
          })
        : [];

    const resultsForStaticEnvVariables = mapStaticEnvVariablesToCompletions(
        requestData,
        filterOutStaticVariablesWithDynamicReferences(
            staticEnvVariables,
            dynamicVariables,
        ),
        // Display static environment variables below dynamic ones and static script variables.
        { prefixForSortText: "c", appendOnInsertion },
    );

    return resultsForDynamicVariables.concat(
        resultsForStaticScriptVariables,
        resultsForStaticEnvVariables,
    );
}

function mapStaticScriptVariables(
    {
        variable: { start, end },
        functionType: sourceReferenceType,
    }: VariableSpecificRequestData,
    allReferences: EquivalentVariableReferencesFromOtherFiles[],
    modifications: {
        prefixForSortText: string;
        appendOnInsertion?: string;
    },
): CompletionItem[] {
    return allReferences.map(
        ({
            mostRelevantReference: {
                path: { relativeToSourceFile: relativePath },
                indirectionLevel,
                reference: { variableName, scope },
            },
        }) => {
            const varsBlockName =
                scope ==
                VariableAvailabilityScopes.PreRequestScriptForOwnItemAndDescendants
                    ? RequestFileBlockName.PreRequestVars
                    : RequestFileBlockName.PostResponseVars;

            return {
                label: variableName,
                labelDetails: {
                    description:
                        relativePath == "."
                            ? `Block ${varsBlockName}`
                            : relativePath,
                },
                kind: CompletionItemKind.Constant,
                detail: [
                    VariableReferenceType.Write,
                    VariableReferenceType.Delete,
                ].includes(sourceReferenceType)
                    ? `WARNING: Will overwrite static script variable.`
                    : undefined,
                sortText: getSortText(
                    modifications.prefixForSortText,
                    variableName,
                    indirectionLevel,
                ),
                textEdit: getTextEdit(
                    variableName,
                    start,
                    end,
                    modifications.appendOnInsertion,
                ),
            };
        },
    );
}

function mapDynamicVariables(
    requestData: VariableSpecificRequestData,
    { fromSameFile, fromOtherFiles }: MatchingDynamicVariables,
    modifications: {
        prefixForSortText: string;
        appendOnInsertion?: string;
    },
) {
    const groupedRefs = groupReferencesByName({ fromSameFile, fromOtherFiles });

    return groupedRefs
        .map((ref) => {
            if (
                ref.hasReferenceInOwnFile &&
                ref.detailsForOwnFileRefs != undefined
            ) {
                return getCompletionForRefsWithinOwnFile(
                    requestData,
                    {
                        ...ref,
                        detailsForOwnFileRefs: ref.detailsForOwnFileRefs,
                    },
                    modifications,
                );
            }

            if (ref.referencesFromOtherFiles != undefined) {
                return getCompletionForRefsFromOnlyOtherFiles(
                    requestData,
                    {
                        ...ref,
                        referencesFromOtherFiles: ref.referencesFromOtherFiles,
                    },
                    modifications,
                );
            }

            return undefined;
        })
        .filter((v) => v != undefined);
}

function getCompletionForRefsWithinOwnFile(
    { variable: { start, end } }: VariableSpecificRequestData,
    groupedReferences: {
        variableName: string;
        referenceType: VariableReferenceType;
        detailsForOwnFileRefs: ReferenceFromOwnFileDetails;
        referencesFromOtherFiles?: EquivalentVariableReferencesFromOtherFiles;
    },
    modifications: {
        prefixForSortText: string;
        appendOnInsertion?: string;
    },
): CompletionItem {
    const {
        detailsForOwnFileRefs: {
            blockName,
            allDistinctBlocks,
            hasDuplicateReferences,
            totalNumberOfReferences: numberOfRefsWithinFile,
        },
        referenceType,
        variableName,
        referencesFromOtherFiles,
    } = groupedReferences;

    const totalNumberOfReferences =
        numberOfRefsWithinFile +
        (referencesFromOtherFiles?.otherMatchingReferences.length ?? -1) +
        1;

    return {
        label: variableName,
        labelDetails: {
            description:
                hasDuplicateReferences && allDistinctBlocks.length > 1
                    ? `Blocks '${allDistinctBlocks.join("','")}'`
                    : `Block '${blockName}'`,
        },
        kind: getKind(referenceType),
        detail:
            !hasDuplicateReferences && referencesFromOtherFiles == undefined
                ? undefined
                : `${totalNumberOfReferences} relevant references in ${allDistinctBlocks.length > 1 ? `blocks ${JSON.stringify(allDistinctBlocks)}` : `block '${blockName}'`}.`.concat(
                      referencesFromOtherFiles == undefined
                          ? ""
                          : ` and in ${referencesFromOtherFiles.otherMatchingReferences.length + 1} other file(s)`,
                  ),
        sortText: getSortText(
            modifications.prefixForSortText,
            variableName,
            0,
            blockName,
        ),
        textEdit: getTextEdit(
            variableName,
            start,
            end,
            modifications.appendOnInsertion,
        ),
    };
}

function getCompletionForRefsFromOnlyOtherFiles(
    { variable: { start, end } }: VariableSpecificRequestData,
    groupedReferences: {
        variableName: string;
        referenceType: VariableReferenceType;
        referencesFromOtherFiles: EquivalentVariableReferencesFromOtherFiles;
    },
    modifications: {
        prefixForSortText: string;
        appendOnInsertion?: string;
    },
): CompletionItem {
    const {
        referenceType,
        variableName,
        referencesFromOtherFiles: {
            mostRelevantReference,
            otherMatchingReferences,
        },
    } = groupedReferences;

    return {
        label: variableName,
        labelDetails: {
            description: `${mostRelevantReference.path.relativeToSourceFile}`,
        },
        kind: getKind(referenceType),
        detail:
            otherMatchingReferences.length == 0
                ? undefined
                : `Relevant reference(s) in ${otherMatchingReferences.length} other file(s).`,
        sortText: getSortText(
            modifications.prefixForSortText,
            variableName,
            mostRelevantReference.indirectionLevel,
        ),
        textEdit: getTextEdit(
            variableName,
            start,
            end,
            modifications.appendOnInsertion,
        ),
    };
}

function filterOutStaticVariablesWithDynamicReferences(
    matchingStaticEnvVariables: {
        environmentFile: string;
        matchingVariableKeys: string[];
        isConfiguredEnv: boolean;
    }[],
    matchingDynamicVariables: MatchingDynamicVariables,
) {
    const allVariableNamesFromDynamicReferences =
        getAllVariableNamesFromDynamicReferences(matchingDynamicVariables);

    return matchingStaticEnvVariables.map(
        ({
            environmentFile,
            isConfiguredEnv,
            matchingVariableKeys: allMatchingKeys,
        }) => ({
            environmentFile,
            isConfiguredEnv,
            matchingVariableKeys: allMatchingKeys.filter(
                (key) => !allVariableNamesFromDynamicReferences.includes(key),
            ),
        }),
    );
}

function getAllVariableNamesFromDynamicReferences(
    matchingDynamicEnvVariables: MatchingDynamicVariables,
) {
    return matchingDynamicEnvVariables.fromSameFile
        .map(({ variableReference: { variableName } }) => variableName)
        .concat(
            matchingDynamicEnvVariables.fromOtherFiles.map(
                ({
                    mostRelevantReference: {
                        reference: { variableName },
                    },
                }) => variableName,
            ),
        );
}

function getKind(referenceType: VariableReferenceType) {
    return referenceType == VariableReferenceType.Read
        ? CompletionItemKind.Field
        : CompletionItemKind.Function;
}

function getTextEdit(
    variableName: string,
    start: Position,
    end: Position,
    appendOnInsertion?: string,
): TextEdit {
    return {
        newText: `${variableName}${appendOnInsertion ?? ""}`,
        range: new Range(start, end),
    };
}

function getSortText(
    prefixForSortText: string,
    variableName: string,
    indirectionLevel: number,
    blockName?: string,
) {
    return `${prefixForSortText ?? ""}_${indirectionLevel}_${variableName}${blockName ?? ""}`;
}
