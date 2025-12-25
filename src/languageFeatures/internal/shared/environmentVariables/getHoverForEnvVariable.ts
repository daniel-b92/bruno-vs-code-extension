import { basename } from "path";
import {
    CancellationToken,
    Hover,
    MarkdownString,
    Position as VsCodePosition,
} from "vscode";
import {
    Block,
    Collection,
    OutputChannelLogger,
    VariableReferenceType,
    getConfiguredTestEnvironment,
    getExtensionForBrunoFiles,
} from "../../../../shared";
import {
    getMatchingDefinitionsFromEnvFiles,
    EnvVariableNameMatchingMode,
} from "./getMatchingDefinitionsFromEnvFiles";
import { getDynamicVariableReferences } from "./getDynamicVariableReferences";

export interface EnvVariableHoverParams {
    requestData: RequestData;
    bruFileSpecificData?: BruFileSpecificData;
    logger?: OutputChannelLogger;
}

interface RequestData {
    collection: Collection;
    variableName: string;
    functionType: VariableReferenceType;
    requestPosition: VsCodePosition;
    token: CancellationToken;
}

interface BruFileSpecificData {
    blockContainingPosition: Block;
    allBlocks: Block[];
}

export function getHoverForEnvVariable({
    requestData,
    bruFileSpecificData,
    logger,
}: EnvVariableHoverParams) {
    const contentForDynamicReferences = bruFileSpecificData
        ? getContentForDynamicVariables(
              requestData,
              bruFileSpecificData,
              logger,
          )
        : undefined;
    const contentForStaticReferences = getContentForStaticVariables(
        requestData,
        logger,
    );

    const resultingMarkdownString =
        contentForDynamicReferences && contentForStaticReferences
            ? new MarkdownString(
                  contentForDynamicReferences.concat(
                      getLineBreak(),
                      contentForStaticReferences,
                  ),
              )
            : contentForDynamicReferences
              ? new MarkdownString(contentForDynamicReferences)
              : contentForStaticReferences
                ? new MarkdownString(contentForStaticReferences)
                : undefined;

    return resultingMarkdownString
        ? new Hover(resultingMarkdownString)
        : undefined;
}

function getContentForStaticVariables(
    requestData: RequestData,
    logger?: OutputChannelLogger,
) {
    const { collection, token, variableName } = requestData;
    const tableHeader = `| value | environment | configured |
| :--------------- | :----------------: | :----------------: | ${getLineBreak()}`;

    const configuredEnvironmentName = getConfiguredTestEnvironment();
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
    requestData: RequestData,
    bruFileSpecificData: BruFileSpecificData,
    logger?: OutputChannelLogger,
) {
    const { variableName, token } = requestData;
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

    const tableHeader = `| Block | Type |
| :--------------- | :----------------: | ${getLineBreak()}`;

    return "**Dynamic references:**".concat(
        getLineBreak(),
        tableHeader,
        variableReferences
            .map(
                ({ blockName, variableReference: { referenceType } }) =>
                    `| ${blockName} | ${referenceType} |`,
            )
            .join(getLineBreak()),
    );
}

function addLogEntryForCancellation(logger?: OutputChannelLogger) {
    logger?.debug(`Cancellation requested for hover provider.`);
}

function getLineBreak() {
    return "\n";
}
