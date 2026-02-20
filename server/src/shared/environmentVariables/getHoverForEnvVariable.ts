import { basename } from "path";
import {
    EnvVariableNameMatchingMode,
    getExtensionForBrunoFiles,
    getMatchingDefinitionsFromEnvFiles,
    Logger,
} from "@global_shared";
import {
    EnvVariableBruFileSpecificData,
    EnvVariableCommonRequestData,
    EnvVariableRequest,
} from "../interfaces";
import { getDynamicVariableReferences } from "../../bruFiles/shared/getDynamicVariableReferences";
import { Hover, MarkupContent } from "vscode-languageserver";

export function getHoverForEnvVariable(
    { requestData, bruFileSpecificData, logger }: EnvVariableRequest,
    configuredEnvironmentName?: string,
): Hover | undefined {
    const contentForDynamicReferences = bruFileSpecificData
        ? getContentForDynamicVariables(
              requestData,
              bruFileSpecificData,
              logger,
          )
        : undefined;
    const contentForStaticReferences = getContentForStaticVariables(
        requestData,
        configuredEnvironmentName,
        logger,
    );

    const resultingMarkdownString: MarkupContent | undefined =
        contentForDynamicReferences && contentForStaticReferences
            ? {
                  kind: "markdown",
                  value: contentForDynamicReferences.concat(
                      "--------------------------",
                      getLineBreak(),
                      contentForStaticReferences,
                  ),
              }
            : contentForDynamicReferences
              ? { kind: "markdown", value: contentForDynamicReferences }
              : contentForStaticReferences
                ? { kind: "markdown", value: contentForStaticReferences }
                : undefined;

    return resultingMarkdownString
        ? { contents: resultingMarkdownString }
        : undefined;
}

function getContentForStaticVariables(
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

function getContentForDynamicVariables(
    requestData: EnvVariableCommonRequestData,
    bruFileSpecificData: EnvVariableBruFileSpecificData,
    logger?: Logger,
) {
    const {
        variable: { name: variableName },
        token,
    } = requestData;
    const { blockContainingPosition, allBlocks } = bruFileSpecificData;

    const variableReferences = getDynamicVariableReferences(
        requestData,
        blockContainingPosition,
        allBlocks,
    ).filter(
        ({ variableReference: { variableName: name } }) => name == variableName,
    );

    if (variableReferences.length == 0) {
        return undefined;
    }
    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    return "**Dynamic references:**".concat(
        getLineBreak(),
        variableReferences
            .map(
                ({ blockName, variableReference: { referenceType } }) =>
                    `- Block '${blockName}'; Type: ${referenceType}`,
            )
            .join(getLineBreak()),
        getLineBreak(),
    );
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(`Cancellation requested for hover provider.`);
}

function getLineBreak() {
    return "\n";
}
