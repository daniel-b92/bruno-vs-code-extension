import {
    Block,
    BrunoVariableReference,
    BrunoVariableType,
    Logger,
    RequestFileBlockName,
    VariableAvailabilityScopes,
    VariableNameMatchingMode,
    VariableReferenceType,
} from "@global_shared";
import { Hover, MarkupContent } from "vscode-languageserver";
import { getHoverContentForStaticEnvVariables } from "../../shared";
import {
    BlockRequestWithAdditionalData,
    EquivalentVariableReferencesFromOtherFiles,
    MatchingDynamicVariables,
} from "../shared/interfaces";
import { includesMultipleDistinctVariableTypes } from "../shared/VariableReferences/includesMultipleDistinctVariableTypes";
import { getAllVariableReferences } from "../shared/VariableReferences/getAllVariableReferences";

export function getHoverForBrunoVariable(
    fullRequest: BlockRequestWithAdditionalData<Block>,
    variableReference: BrunoVariableReference,
    configuredEnvironmentName?: string,
): Hover | undefined {
    const {
        request: { token },
        logger,
    } = fullRequest;
    const { variableName, variableType, referenceType } = variableReference;

    const allRefs = getAllVariableReferences(
        fullRequest,
        variableReference,
        configuredEnvironmentName,
        VariableNameMatchingMode.Exact,
    );

    if (!allRefs) {
        return undefined;
    }

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const {
        staticReferences: { fromEnvironmentFiles, fromScriptVariableBlocks },
        dynamicReferences,
    } = allRefs;

    const staticRefsForScriptVariables = fromScriptVariableBlocks.filter(
        ({
            mostRelevantReference: {
                reference: { variableName: n },
            },
        }) => n == variableName,
    );
    const dynamicRefsWithinSameFile = dynamicReferences.withinSameFile.filter(
        ({ variableReference: { variableName: name } }) => name == variableName,
    );
    const dynamicRefsFromOtherFiles = dynamicReferences.fromOtherFiles.filter(
        ({
            mostRelevantReference: {
                reference: { variableName: n },
            },
        }) => n == variableName,
    );

    const hasDynamicReferences =
        dynamicRefsWithinSameFile.length > 0 ||
        dynamicRefsFromOtherFiles.length > 0;
    const contentForDynamicReferences = !hasDynamicReferences
        ? undefined
        : getContentForDynamicReferences(
              {
                  fromSameFile: dynamicRefsWithinSameFile,
                  fromOtherFiles: dynamicRefsFromOtherFiles,
              },
              variableType,
          );

    const contentForStaticReferences = (
        getHoverContentForStaticEnvVariables(fromEnvironmentFiles) ?? ""
    ).concat(
        getContentForStaticScriptVarsReferences(
            staticRefsForScriptVariables,
            referenceType,
        ) ?? "",
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

function getContentForStaticScriptVarsReferences(
    references: EquivalentVariableReferencesFromOtherFiles[],
    sourceReferenceType: VariableReferenceType,
) {
    if (references.length == 0) {
        return undefined;
    }

    const lineBreak = getLineBreak();
    const tableHeader = "| file | block |".concat(
        lineBreak,
        "| :--------------- | :----------------: |",
        lineBreak,
    );

    return "**Static scripting variable references".concat(
        sourceReferenceType == VariableReferenceType.Write
            ? " (will be overwritten)"
            : "",
        ":**",
        lineBreak,
        tableHeader,
        references
            .map(
                ({
                    mostRelevantReference: {
                        path: { relativeToSourceFile },
                        reference: { scope },
                    },
                    otherMatchingReferences,
                }) => {
                    const textForFileColumn = relativeToSourceFile.concat(
                        otherMatchingReferences.length > 0
                            ? ` [+ ${otherMatchingReferences.length} others]`
                            : "",
                    );
                    const textForBlockColumn =
                        scope ==
                        VariableAvailabilityScopes.PreRequestScriptForOwnItemAndDescendants
                            ? RequestFileBlockName.PreRequestVars
                            : RequestFileBlockName.PostResponseVars;

                    return `| ${textForFileColumn} | ${textForBlockColumn} |`;
                },
            )
            .join(lineBreak),
        lineBreak,
        lineBreak,
    );
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
                    `| . | ${blockName} | ${referenceType} | ${displayVariableType ? `${variableType} |` : ""}`,
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
