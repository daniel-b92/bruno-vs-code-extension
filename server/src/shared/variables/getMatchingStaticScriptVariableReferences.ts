import {
    BrunoVariableReference,
    BrunoVariableType,
    normalizePath,
    VariableScopeSectionKind,
    VariableAvailabilityScope,
    VariableAvailabilityScopes,
    VariableReferenceType,
} from "@global_shared";
import {
    VariableSectionRequest,
    EquivalentVariableReferencesFromOtherFiles,
    StaticScriptVariableReference,
} from "./interfaces";
import { relative } from "path";
import { areReferencesEquivalentForLanguageFeatures } from "./areReferencesEquivalentForLanguageFeatures";
import { isDynamicVariableReference } from "./isDynamicVariableReference";

export function getMatchingStaticScriptVariableReferences(
    {
        file: { allSections, sectionContainingPosition, collection },
        request: { filePath },
    }: VariableSectionRequest,
    variableType: BrunoVariableType.Folder | BrunoVariableType.Request,
): EquivalentVariableReferencesFromOtherFiles<StaticScriptVariableReference>[] {
    const relevantScope =
        sectionContainingPosition.kind ==
        VariableScopeSectionKind.PreRequestScript
            ? VariableAvailabilityScopes.PreRequestScriptForOwnItemAndDescendants
            : VariableAvailabilityScopes.PostResponseScriptForOwnItemAndDescendants;
    // Avoid using cached data for determining references within own file because unsaved changes would be ignored.
    const allReferencesFromSameFile = allSections.flatMap(
        ({ name: sectionName, variableReferences }) =>
            (variableReferences ?? []).map((reference) => ({
                reference,
                sectionName,
            })),
    );

    const relevantReferencesFromSameFile = {
        path: { absolute: filePath, relativeToSourceFile: "." },
        indirectionLevel: 0,
        references: getRelevantReferences(
            allReferencesFromSameFile,
            variableType,
            relevantScope,
        ),
    };

    const relevantReferencesFromOtherFiles = collection
        .getCommonAncestorData(filePath)
        .filter(
            ({ item, additionalData }) =>
                additionalData != undefined &&
                normalizePath(item.getPath()) != normalizePath(filePath),
        )
        .map(({ item, additionalData }) => ({
            path: {
                absolute: item.getPath(),
                relativeToSourceFile: relative(filePath, item.getPath()),
            },
            references: getRelevantReferences(
                additionalData?.map(({ reference, sectionName }) => ({
                    reference,
                    sectionName,
                })) ?? [],
                variableType,
                relevantScope,
            ),
        }))
        // Sort paths descending by length
        .sort(
            ({ path: { absolute: path1 } }, { path: { absolute: path2 } }) =>
                path2.length - path1.length,
        )
        // indirection level starts with 1 because only references from ancestor items are counted here.
        .map((data, index) => ({ ...data, indirectionLevel: index + 1 }));

    return groupReferences(
        relevantReferencesFromOtherFiles.concat(relevantReferencesFromSameFile),
    );
}

function getRelevantReferences(
    refs: ReferenceWithSectionName[],
    variableType: BrunoVariableType,
    relevantScope: VariableAvailabilityScope,
) {
    return refs.filter(
        ({ reference: { referenceType, scope, variableType: v } }) =>
            !isDynamicVariableReference(scope) &&
            referenceType == VariableReferenceType.Write &&
            scope == relevantScope &&
            v == variableType,
    );
}

function groupReferences(
    allReferences: {
        path: { absolute: string; relativeToSourceFile: string };
        references: ReferenceWithSectionName[];
        indirectionLevel: number;
    }[],
) {
    return allReferences
        .flatMap(({ path, indirectionLevel, references }) =>
            references.map(({ reference, sectionName }) => ({
                path,
                indirectionLevel,
                reference,
                sectionName,
            })),
        )
        .reduce((prev, curr) => {
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

            if (curr.indirectionLevel < mostRelevantSoFar.indirectionLevel) {
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
                          mostRelevantReference: entry.mostRelevantReference,
                          otherMatchingReferences:
                              entry.otherMatchingReferences.concat(curr),
                      },
            );
        }, [] as EquivalentVariableReferencesFromOtherFiles<StaticScriptVariableReference>[]);
}

interface ReferenceWithSectionName {
    reference: BrunoVariableReference;
    sectionName: string;
}
