import {
    BrunoVariableReference,
    CodeBlock,
    normalizePath,
    RequestFileBlockName,
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
            path: {
                absolute: item.getPath(),
                relativeToSourceFile:
                    normalizePath(item.getPath()) == normalizePath(filePath)
                        ? // For some reason, the 'relative' function returns an empty string if both parameters are the same path.
                          "."
                        : relative(filePath, item.getPath()),
            },
            references: (additionalData as BrunoVariableReference[]).filter(
                ({ referenceType, scope }) =>
                    !isDynamicVariableReference(scope) &&
                    referenceType == VariableReferenceType.Write &&
                    scope == relevantScope,
            ),
        }))
        // Sort paths descending by length
        .sort(
            ({ path: { absolute: path1 } }, { path: { absolute: path2 } }) =>
                path2.length - path1.length,
        )
        .map((data, index) => ({ ...data, indirectionLevel: index }));

    return groupReferences(relevantReferences);
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
