import { VariableReferenceType } from "@global_shared";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import {
    getOverwriteWarning,
    getSingleEnvironmentLabel,
    groupByVariableKey,
    shouldShowWarning,
} from "./staticEnvVariableCompletionUtils";
import { getHoverContentForStaticEnvVariables } from "./getHoverContentForStaticEnvVariables";

type MatchFromCollection = Parameters<
    typeof getHoverContentForStaticEnvVariables
>[0][number];

/**
 * Creates exactly one completion item per variable name, even if the variable is defined in multiple environments or collections.
 * The details about the definitions are provided in the documentation of the item.
 */
export function mapStaticEnvVariablesFromMultipleCollectionsToCompletions(
    functionType: VariableReferenceType,
    matches: MatchFromCollection[],
): CompletionItem[] {
    const matchesByKey = groupByVariableKey(matches, ({ matchingVariables }) =>
        matchingVariables.map(({ key }) => key),
    );

    return [...matchesByKey.entries()].map(([key, matchesForKey]) => {
        const collectionNames = [
            ...new Set(
                matchesForKey.flatMap(({ collectionName }) =>
                    collectionName !== undefined ? [collectionName] : [],
                ),
            ),
        ];
        const isConfiguredInAnyCollection = matchesForKey.some(
            ({ isConfiguredEnv }) => isConfiguredEnv,
        );
        const showWarning = shouldShowWarning(functionType);

        return {
            label: key,
            labelDetails: {
                description: `${showWarning ? "!Env!" : "Env"} ${getDescriptionSuffix(matchesForKey, collectionNames)}`,
            },
            detail: showWarning
                ? getOverwriteWarning(matchesForKey.map(({ file }) => file))
                : undefined,
            documentation: {
                kind: "markdown",
                value:
                    getHoverContentForStaticEnvVariables(
                        matchesForKey.map((match) => ({
                            ...match,
                            matchingVariables: match.matchingVariables.filter(
                                (variable) => variable.key == key,
                            ),
                        })),
                    ) ?? "",
            },
            kind: CompletionItemKind.Constant,
            sortText: `_${isConfiguredInAnyCollection ? "a" : "b"}_${key}`,
        };
    });
}

function getDescriptionSuffix(
    matchesForKey: MatchFromCollection[],
    collectionNames: string[],
) {
    if (collectionNames.length > 1) {
        return "(multiple collections)";
    }

    if (matchesForKey.length > 1) {
        return collectionNames.length == 1
            ? `collection '${collectionNames[0]}'`
            : `(${matchesForKey.length} environments)`;
    }

    const { file, inheritedByEnvironmentName } = matchesForKey[0];

    return getSingleEnvironmentLabel(file, inheritedByEnvironmentName);
}
