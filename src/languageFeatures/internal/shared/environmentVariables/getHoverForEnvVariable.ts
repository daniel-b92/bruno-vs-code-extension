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
    groupReferencesByName,
} from "../../../../shared";
import {
    getMatchingDefinitionsFromEnvFiles,
    EnvVariableNameMatchingMode,
} from "./getMatchingDefinitionsFromEnvFiles";
import { getDynamicVariableReferences } from "./getDynamicVariableReferences";

export function getHoverForEnvVariable(params: {
    collection: Collection;
    variableName: string;
    blockContainingPosition: Block;
    token: CancellationToken;
    logger?: OutputChannelLogger;
}) {
    const contentForDynamicReferences = getContentForDynamicReferences({});
    const contentForStaticReferences = getContentForStaticReferences(params);

    return contentForStaticReferences
        ? new Hover(contentForStaticReferences)
        : undefined;
}

function getContentForStaticReferences(params: {
    collection: Collection;
    variableName: string;
    token: CancellationToken;
    logger?: OutputChannelLogger;
}) {
    const { collection, token, variableName, logger } = params;
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

    return new MarkdownString(
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
                        .join(getLineBreak());
                })
                .join(getLineBreak()),
        ),
    );
}

function getContentForDynamicReferences(
    requestData: {
        functionType: VariableReferenceType;
        requestPosition: VsCodePosition;
        token: CancellationToken;
    },
    additionalData: {
        variableName: string;
        blockContainingPosition: Block;
        allBlocks: Block[];
    },
    logger?: OutputChannelLogger,
) {
    const { token } = requestData;
    const { variableName, blockContainingPosition, allBlocks } = additionalData;

    const variableReferences = getDynamicVariableReferences(
        requestData,
        blockContainingPosition,
        allBlocks,
    ).filter(
        ({ variableReference: { variableName: name } }) => name == variableName,
    );

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return [];
    }

    const referencesForVariable = groupReferencesByName(
        variableReferences,
    ).find(({ variableName: name }) => name == variableName);

    if (!referencesForVariable) {
        return undefined;
    }

    const {
        references: {
            hasDuplicateReferences,
            distinctBlocks,
            totalNumberOfReferences,
        },
    } = referencesForVariable;

    return hasDuplicateReferences
        ? new MarkdownString(
              `A total of ${totalNumberOfReferences} dynamic references exist in blocks ${JSON.stringify(distinctBlocks)}`,
          )
        : new MarkdownString(
              distinctBlocks.length > 0
                  ? `Dynamic reference exists in block '${distinctBlocks[0]}'`
                  : undefined,
          );
}

function addLogEntryForCancellation(logger?: OutputChannelLogger) {
    logger?.debug(`Cancellation requested for hover provider.`);
}

function getLineBreak() {
    return "\\n";
}
