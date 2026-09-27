import { basename } from "path";
import { getExtensionForBrunoFiles, Range } from "@global_shared";

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
    }[],
) {
    if (matches.length == 0) {
        return undefined;
    }

    const tableHeader = `| value | environment | configured |
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
                }) => {
                    const environmentName = basename(
                        file,
                        getExtensionForBrunoFiles(),
                    );
                    const environmentColumnText = inheritedByEnvironmentName
                        ? `${environmentName} (inherited by '${inheritedByEnvironmentName}')`
                        : environmentName;

                    return matchingVariables
                        .map(
                            ({ value }) =>
                                `| ${value} | ${environmentColumnText}  | ${isConfiguredEnv ? "&#x2611;" : "-"} |`,
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
