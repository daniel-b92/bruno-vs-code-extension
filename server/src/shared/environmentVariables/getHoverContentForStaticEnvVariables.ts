import { basename } from "path";
import {
    EnvVariableNameMatchingMode,
    getExtensionForBrunoFiles,
    getMatchingDefinitionsFromEnvFiles,
    Logger,
} from "@global_shared";
import { EnvVariableCommonRequestData } from "../interfaces";

export function getHoverContentForStaticEnvVariables(
    requestData: EnvVariableCommonRequestData,
    configuredEnvironmentName?: string,
    logger?: Logger,
) {
    const {
        collection,
        token,
        variable: { name: variableName },
    } = requestData;
    const tableHeader = `| value | environment | configured |
| :--------------- | :----------------: | :----------------: | ${getLineBreak()}`;

    const matchingVariableDefinitions = getMatchingDefinitionsFromEnvFiles(
        collection,
        variableName,
        EnvVariableNameMatchingMode.Exact,
        configuredEnvironmentName,
    );

    if (matchingVariableDefinitions.length == 0) {
        return undefined;
    }

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    return "**Static references:**".concat(
        getLineBreak(),
        tableHeader,
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
                    .join(getLineBreak());
            })
            .join(getLineBreak()),
    );
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(`Cancellation requested for hover provider.`);
}

function getLineBreak() {
    return "\n";
}
