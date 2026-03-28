import {
    Block,
    BrunoVariableReference,
    BrunoVariableType,
    EnvVariableNameMatchingMode,
    getMatchingDefinitionsFromEnvFiles,
    Logger,
} from "@global_shared";
import { getDynamicVariableReferencesWithinFile } from "../shared/VariableReferences/getDynamicVariableReferencesWithinFile";
import { Hover, MarkupContent } from "vscode-languageserver";
import { getHoverContentForStaticEnvVariables } from "../../shared";
import {
    BlockRequestWithAdditionalData,
    MatchingDynamicVariables,
} from "../shared/interfaces";
import { getDynamicVariableReferencesFromOtherFiles } from "../shared/VariableReferences/getDynamicVariableReferencesFromOtherFiles";
import { includesMultipleDistinctVariableTypes } from "../shared/VariableReferences/includesMultipleDistinctVariableTypes";

export function getHoverForBrunoVariable(
    fullRequest: BlockRequestWithAdditionalData<Block>,
    { variableName, referenceType, variableType }: BrunoVariableReference,
    configuredEnvironmentName?: string,
): Hover | undefined {
    const {
        request: { token, filePath },
        file: { collection },
        logger,
    } = fullRequest;

    const dynamicReferencesWithinFile = getDynamicVariableReferencesWithinFile(
        fullRequest,
        referenceType,
        variableType,
    ).filter(
        ({ variableReference: { variableName: name } }) => name == variableName,
    );

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const dynamicReferencesFromOtherFiles =
        getDynamicVariableReferencesFromOtherFiles(
            filePath,
            collection,
            referenceType,
            variableType,
        ).filter(
            ({
                mostRelevantReference: {
                    reference: { variableName: n },
                },
            }) => n == variableName,
        );

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const hasDynamicReferences =
        dynamicReferencesWithinFile.length > 0 ||
        dynamicReferencesFromOtherFiles.length > 0;
    const contentForDynamicReferences = !hasDynamicReferences
        ? undefined
        : getContentForDynamicReferences(
              {
                  fromSameFile: dynamicReferencesWithinFile,
                  fromOtherFiles: dynamicReferencesFromOtherFiles,
              },
              variableType,
          );

    const matchingStaticEnvVariableDefinitions = [
        BrunoVariableType.Environment,
        BrunoVariableType.Unknown,
    ].includes(variableType)
        ? getMatchingDefinitionsFromEnvFiles(
              collection,
              variableName,
              EnvVariableNameMatchingMode.Exact,
              configuredEnvironmentName,
          )
        : [];
    const contentForStaticReferences = getHoverContentForStaticEnvVariables(
        matchingStaticEnvVariableDefinitions,
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
              ? {
                    kind: "markdown",
                    value: contentForDynamicReferences,
                }
              : contentForStaticReferences
                ? { kind: "markdown", value: contentForStaticReferences }
                : undefined;

    return resultingMarkdownString
        ? { contents: resultingMarkdownString }
        : undefined;
}

function getContentForDynamicReferences(
    { fromSameFile, fromOtherFiles }: MatchingDynamicVariables,
    sourceFileVariableType: BrunoVariableType,
) {
    if (fromSameFile.length == 0 && fromOtherFiles.length == 0) {
        return undefined;
    }

    const lineBreak = getLineBreak();
    const displayVariableType =
        includesMultipleDistinctVariableTypes({
            fromSameFile,
            fromOtherFiles,
        }) || sourceFileVariableType == BrunoVariableType.Unknown;
    const tableHeader = "| file | block | reference type |".concat(
        displayVariableType ? "variable type |" : "",
        `${lineBreak} | :--------------- | :----------------: | :----------------: |`,
        displayVariableType ? ":----------------: |" : "",
        lineBreak,
    );

    return "**Dynamic references:**".concat(
        lineBreak,
        tableHeader,
        fromSameFile
            .map(
                ({
                    blockName,
                    variableReference: { referenceType, variableType },
                }) =>
                    `| - | ${blockName} | ${referenceType} | ${displayVariableType ? `${variableType} |` : ""}`,
            )
            .join(lineBreak),
        fromSameFile.length > 0 ? lineBreak : "",
        fromOtherFiles
            .map(
                ({
                    mostRelevantReference: {
                        path: { relativeToSourceFile },
                        reference: { referenceType, variableType },
                    },
                    otherMatchingReferences,
                }) =>
                    `| ${relativeToSourceFile.concat(otherMatchingReferences.length > 0 ? ` [+ ${otherMatchingReferences.length} others]` : "")} | - | ${referenceType} | ${displayVariableType ? `${variableType} |` : ""}`,
            )
            .join(lineBreak),
        lineBreak,
        lineBreak,
    );
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(`Cancellation requested for hover provider.`);
}

function getLineBreak() {
    return "\n";
}
