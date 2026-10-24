import { parse } from "path";
import { VariableReferenceType } from "@global_shared";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { shouldShowWarning } from "./mapStaticEnvVariablesToCompletions";
import { getHoverContentForStaticEnvVariables } from "./getHoverContentForStaticEnvVariables";

type MatchFromCollection = Parameters<
    typeof getHoverContentForStaticEnvVariables
>[0][number] & { collectionName: string };

/**
 * Creates exactly one completion item per variable name, even if the variable is defined in multiple environments or collections.
 * The details about the definitions are provided in the documentation of the item.
 */
export function mapStaticEnvVariablesFromMultipleCollectionsToCompletions(
    functionType: VariableReferenceType,
    matches: MatchFromCollection[],
): CompletionItem[] {
    const matchesByKey = new Map<string, MatchFromCollection[]>();

    for (const match of matches) {
        for (const { key } of match.matchingVariables) {
            matchesByKey.set(key, [...(matchesByKey.get(key) ?? []), match]);
        }
    }

    return [...matchesByKey.entries()].map(([key, matchesForKey]) => {
        const collectionNames = [
            ...new Set(
                matchesForKey.map(({ collectionName }) => collectionName),
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
                ? matchesForKey.length == 1
                    ? `WARNING: Will overwrite persistent environment variable from env '${parse(matchesForKey[0].file).name}'`
                    : "WARNING: Will overwrite persistent environment variable(s)"
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
        return `collection '${collectionNames[0]}'`;
    }

    const { file, inheritedByEnvironmentName } = matchesForKey[0];
    const environmentName = parse(file).name;

    return inheritedByEnvironmentName
        ? `'${environmentName}' (inherited by '${inheritedByEnvironmentName}')`
        : `'${environmentName}'`;
}
