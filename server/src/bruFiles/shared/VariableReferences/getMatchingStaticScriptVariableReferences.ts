import {
    BrunoVariableReference,
    CodeBlock,
    normalizePath,
    RequestFileBlockName,
    VariableAvailabilityScope,
    VariableAvailabilityScopes,
    VariableReferenceType,
} from "@global_shared";
import {
    BlockRequestWithAdditionalData,
    EquivalentVariableReferencesFromOtherFiles,
    VariableReferenceFromOtherFile,
} from "../interfaces";
import { relative } from "path";
import { areReferencesEquivalentForLanguageFeatures } from "./areReferencesEquivalentForLanguageFeatures";
import { isDynamicVariableReference } from "./isDynamicVariableReference";

export function getMatchingStaticScriptVariableReferences({
    file: { allBlocks, blockContainingPosition, collection },
    request: { filePath },
}: BlockRequestWithAdditionalData<CodeBlock>): EquivalentVariableReferencesFromOtherFiles[] {
    const relevantScope =
        blockContainingPosition.name == RequestFileBlockName.PreRequestScript
            ? VariableAvailabilityScopes.PreRequestScriptForOwnItemAndDescendants
            : VariableAvailabilityScopes.PostResponseScriptForOwnItemAndDescendants;

    // Avoid using cached data for determining references within own file because unsaved changes would be ignored.
    const allReferencesFromSameFile = allBlocks.flatMap(
        ({ variableReferences }) => variableReferences ?? [],
    );

    const relevantReferencesFromSameFile = {
        path: { absolute: filePath, relativeToSourceFile: "." },
        indirectionLevel: 0,
        references: getRelevantReferences(
            allReferencesFromSameFile,
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
                additionalData as BrunoVariableReference[],
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
    refs: BrunoVariableReference[],
    relevantScope: VariableAvailabilityScope,
) {
    return refs.filter(
        ({ referenceType, scope }) =>
            !isDynamicVariableReference(scope) &&
            referenceType == VariableReferenceType.Write &&
            scope == relevantScope,
    );
}

function groupReferences(
    allReferences: {
        path: { absolute: string; relativeToSourceFile: string };
        references: BrunoVariableReference[];
        indirectionLevel: number;
    }[],
) {
    return allReferences
        .flatMap(({ path, indirectionLevel, references }) =>
            references.map((reference) => ({
                path,
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
