import { basename } from "path";
import { CancellationToken, Hover, MarkdownString } from "vscode";
import {
    Collection,
    OutputChannelLogger,
    getConfiguredTestEnvironment,
    getExtensionForBrunoFiles,
} from "../../../../shared";
import {
    getMatchingEnvironmentVariableDefinitionsFromEnvFiles,
    EnvVariableNameMatchingMode,
} from "./getMatchingEnvironmentVariableDefinitionsFromEnvFiles";

export function getHoverForEnvironmentVariable(
    collection: Collection,
    variableName: string,
    token: CancellationToken,
    logger?: OutputChannelLogger,
) {
    const tableHeader = `| value | environment | configured |
| :--------------- | :----------------: | :----------------: | \n`;

    const configuredEnvironmentName = getConfiguredTestEnvironment();
    const matchingVariableDefinitions =
        getMatchingEnvironmentVariableDefinitionsFromEnvFiles(
            collection,
            variableName,
            EnvVariableNameMatchingMode.Exact,
            configuredEnvironmentName,
        );

    if (matchingVariableDefinitions.length == 0) {
        return undefined;
    }

    if (token.isCancellationRequested) {
        logger?.debug(`Cancellation requested for hover provider.`);
        return undefined;
    }

    return new Hover(
        new MarkdownString(
            tableHeader.concat(
                matchingVariableDefinitions
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
                            .join("\n");
                    })
                    .join("\n"),
            ),
        ),
    );
}
