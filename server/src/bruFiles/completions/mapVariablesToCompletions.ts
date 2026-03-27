import {
    VariableReferenceType,
    Range,
    BrunoVariableReference,
    Position,
} from "@global_shared";
import {
    VariableCommonRequestData,
    groupReferencesByName,
    mapStaticEnvVariablesToCompletions,
    ReferenceFromOwnFileDetails,
} from "../../shared";
import {
    CompletionItem,
    CompletionItemKind,
    TextEdit,
} from "vscode-languageserver";
import { EquivalentDynamicReferencesFromOtherFiles } from "../shared/interfaces";

interface MatchingDynamicVariables {
    fromSameFile: {
        blockName: string;
        variableReference: BrunoVariableReference;
    }[];
    fromOtherFiles: EquivalentDynamicReferencesFromOtherFiles[];
}

export function mapVariablesToCompletions(
    matchingStaticEnvVariables: {
        environmentFile: string;
        matchingVariableKeys: string[];
        isConfiguredEnv: boolean;
    }[],
    matchingDynamicVariables: MatchingDynamicVariables,
    requestData: VariableCommonRequestData,
    appendOnInsertion?: string,
) {
    const resultsForDynamicVariables = mapDynamicVariables(
        requestData,
        matchingDynamicVariables,
        {
            prefixForSortText: "a",
            appendOnInsertion,
        },
    );

    const resultsForStaticVariables = mapStaticEnvVariablesToCompletions(
        requestData,
        filterOutStaticVariablesWithDynamicReferences(
            matchingStaticEnvVariables,
            matchingDynamicVariables,
        ),
        // Display static environment variables below dynamic ones.
        { prefixForSortText: "b", appendOnInsertion },
    );

    return resultsForDynamicVariables.concat(resultsForStaticVariables);
}

function mapDynamicVariables(
    requestData: VariableCommonRequestData,
    { fromSameFile, fromOtherFiles }: MatchingDynamicVariables,
    modifications: {
        prefixForSortText: string;
        appendOnInsertion?: string;
    },
) {
    const groupedRefs = groupReferencesByName(fromSameFile, fromOtherFiles);

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
    { variable: { start, end } }: VariableCommonRequestData,
    groupedReferences: {
        variableName: string;
        referenceType: VariableReferenceType;
        detailsForOwnFileRefs: ReferenceFromOwnFileDetails;
        referencesFromOtherFiles?: EquivalentDynamicReferencesFromOtherFiles;
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
    { variable: { start, end } }: VariableCommonRequestData,
    groupedReferences: {
        variableName: string;
        referenceType: VariableReferenceType;
        referencesFromOtherFiles: EquivalentDynamicReferencesFromOtherFiles;
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
    matchingDynamicEnvVariables: MatchingDynamicVariables,
) {
    const allVariableNamesFromDynamicReferences =
        matchingDynamicEnvVariables.fromSameFile
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
