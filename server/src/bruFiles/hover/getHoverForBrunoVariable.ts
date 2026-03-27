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
    EquivalentDynamicReferencesFromOtherFiles,
} from "../shared/interfaces";
import { getDynamicVariableReferencesFromOtherFiles } from "../shared/VariableReferences/getDynamicVariableReferencesFromOtherFiles";

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
              dynamicReferencesWithinFile,
              dynamicReferencesFromOtherFiles,
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
    fromOwnFile: {
        blockName: string;
        variableReference: BrunoVariableReference;
    }[],
    fromOtherFiles: EquivalentDynamicReferencesFromOtherFiles[],
    sourceFileVariableType: BrunoVariableType,
) {
    if (fromOwnFile.length == 0 && fromOtherFiles.length == 0) {
        return undefined;
    }

    const lineBreak = getLineBreak();
    const displayVariableType =
        includesMultipleDistinctVariableTypes(fromOwnFile, fromOtherFiles) ||
        sourceFileVariableType == BrunoVariableType.Unknown;
    const tableHeader = "| file | block | reference type |".concat(
        displayVariableType ? "variable type |" : "",
        `${lineBreak} | :--------------- | :----------------: | :----------------: |`,
        displayVariableType ? ":----------------: |" : "",
        lineBreak,
    );

    return "**Dynamic references:**".concat(
        lineBreak,
        tableHeader,
        fromOwnFile
            .map(
                ({
                    blockName,
                    variableReference: { referenceType, variableType },
                }) =>
                    `| - | ${blockName} | ${referenceType} | ${displayVariableType ? `${variableType} |` : ""}`,
            )
            .join(lineBreak),
        fromOwnFile.length > 0 ? lineBreak : "",
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

function includesMultipleDistinctVariableTypes(
    fromOwnFile: {
        blockName: string;
        variableReference: BrunoVariableReference;
    }[],
    fromOtherFiles: EquivalentDynamicReferencesFromOtherFiles[],
) {
    const allVariableTypes = fromOwnFile
        .map(({ variableReference: { variableType } }) => variableType)
        .concat(
            fromOtherFiles.map(
                ({
                    mostRelevantReference: {
                        reference: { variableType },
                    },
                }) => variableType,
            ),
        );

    return allVariableTypes.some((val) => allVariableTypes.indexOf(val) != 0);
}
