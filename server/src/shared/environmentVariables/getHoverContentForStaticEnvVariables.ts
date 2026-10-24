import { parse } from "path";
import { Range } from "@global_shared";
import { wrapInCodeSpan } from "../markdown/wrapInCodeSpan";

export function getHoverContentForStaticEnvVariables(
    matches: {
        file: string;
        matchingVariables: {
            key: string;
            keyRange: Range;
            value: string;
            valueRange: Range;
        }[];
        isConfiguredEnv: boolean;
        inheritedByEnvironmentName?: string;
        /** If set for any match, an additional column for the collection is shown. */
        collectionName?: string;
    }[],
) {
    if (matches.length == 0) {
        return undefined;
    }

    const showCollectionColumn = matches.some(
        ({ collectionName }) => collectionName !== undefined,
    );
    const tableHeader = showCollectionColumn
        ? `| value | collection | environment | configured |
| :--------------- | :----------------: | :----------------: | :----------------: | ${getLineBreak()}`
        : `| value | environment | configured |
| :--------------- | :----------------: | :----------------: | ${getLineBreak()}`;

    return "**Persistent environment variable references:**".concat(
        getLineBreak(),
        tableHeader,
        matches
            .map(
                ({
                    file,
                    matchingVariables,
                    isConfiguredEnv,
                    inheritedByEnvironmentName,
                    collectionName,
                }) => {
                    const environmentName = parse(file).name;
                    const environmentColumnText = inheritedByEnvironmentName
                        ? `${environmentName} (inherited by '${inheritedByEnvironmentName}')`
                        : environmentName;

                    return matchingVariables
                        .map(
                            ({ value }) =>
                                `| ${wrapInCodeSpan(value)} | ${showCollectionColumn ? `${wrapInCodeSpan(collectionName ?? "")} | ` : ""}${wrapInCodeSpan(environmentColumnText)} | ${isConfiguredEnv ? "&#x2611;" : "-"} |`,
                        )
                        .join(getLineBreak());
                },
            )
            .join(getLineBreak()),
    );
}

function getLineBreak() {
    return "\n";
}
