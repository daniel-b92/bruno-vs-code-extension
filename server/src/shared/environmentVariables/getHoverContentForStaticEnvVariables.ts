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
    }[],
) {
    if (matches.length == 0) {
        return undefined;
    }

    const tableHeader = `| value | environment | configured |
| :--------------- | :----------------: | :----------------: | ${getLineBreak()}`;

    return "**Static references:**".concat(
        getLineBreak(),
        tableHeader,
        matches
            .map(({ file, matchingVariables, isConfiguredEnv }) => {
                const environmentName = basename(
                    file,
                    getExtensionForBrunoFiles(),
                );

                return matchingVariables
                    .map(
                        ({ value }) =>
                            `| ${value} | ${environmentName}  | ${isConfiguredEnv ? "&#x2611;" : "-"} |`,
                    )
                    .join(getLineBreak());
            })
            .join(getLineBreak()),
    );
}

function getLineBreak() {
    return "\n";
}
