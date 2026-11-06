import {
    BrunoVariableReference,
    BrunoVariableType,
    Logger,
    VariableReferenceType,
} from "@global_shared";
import { Hover, MarkupContent } from "vscode-languageserver";
import { getHoverContentForStaticEnvVariables, wrapInCodeSpan } from "..";
import {
    VariableSectionRequest,
    EquivalentVariableReferencesFromOtherFiles,
    MatchingDynamicVariables,
    StaticScriptVariableReference,
} from "./interfaces";
import { includesMultipleDistinctVariableTypes } from "./includesMultipleDistinctVariableTypes";
import { getAllVariableReferences } from "./getAllVariableReferences";
import { getDeleteWarning } from "./getDeleteWarning";

export function getHoverForBrunoVariable(
    fullRequest: VariableSectionRequest,
    variableReference: BrunoVariableReference,
    configuredEnvironmentName?: string,
): Hover | undefined {
    const {
        request: { token },
        logger,
    } = fullRequest;
    const { variableName, variableType, referenceType } = variableReference;

    const allRefs = getAllVariableReferences(fullRequest, variableReference, {
        configuredEnvironment: configuredEnvironmentName,
        variableNameForFiltering: variableName,
    });

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

    const isDelete = referenceType == VariableReferenceType.Delete;
    // The reads that are executed after the deletion are the ones that can break.
    const contentForReadsAfterDeletion = isDelete
        ? getContentForReadsAfterDeletion(
              fullRequest,
              variableReference,
              configuredEnvironmentName,
          )
        : undefined;

    const contentParts = [
        contentForDynamicReferences,
        contentForReadsAfterDeletion,
        contentForStaticReferences,
    ].filter((content) => content != undefined && content != "");

    if (contentParts.length == 0) {
        return undefined;
    }

    const lineBreak = getLineBreak();
    const warning = isDelete
        ? `**⚠ ${getDeleteWarning(variableType)}**`.concat(lineBreak, lineBreak)
        : "";
    const resultingMarkdownString: MarkupContent = {
        kind: "markdown",
        value: warning.concat(
            contentParts.join("--------------------------".concat(lineBreak)),
        ),
    };

    return { contents: resultingMarkdownString };
}

function getContentForReadsAfterDeletion(
    fullRequest: VariableSectionRequest,
    variableReference: BrunoVariableReference,
    configuredEnvironmentName?: string,
) {
    const { variableName, variableType } = variableReference;
    // Searching for references of a write function finds the reads that are executed afterwards.
    const allRefs = getAllVariableReferences(
        fullRequest,
        { referenceType: VariableReferenceType.Write, variableType },
        {
            configuredEnvironment: configuredEnvironmentName,
            variableNameForFiltering: variableName,
        },
    );

    if (!allRefs) {
        return undefined;
    }

    const { withinSameFile, fromOtherFiles } = allRefs.dynamicReferences;

    return getContentForDynamicReferences(
        {
            fromSameFile: withinSameFile.filter(
                ({ variableReference: { variableName: n } }) =>
                    n == variableName,
            ),
            fromOtherFiles: fromOtherFiles.filter(
                ({
                    mostRelevantReference: {
                        reference: { variableName: n },
                    },
                }) => n == variableName,
            ),
        },
        variableType,
        "Reads after the deletion:",
    );
}

function getContentForStaticScriptVarsReferences(
    references: EquivalentVariableReferencesFromOtherFiles<StaticScriptVariableReference>[],
    sourceReferenceType: VariableReferenceType,
) {
    if (references.length == 0) {
        return undefined;
    }

    const lineBreak = getLineBreak();
    const tableHeader = "| file | section |".concat(
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
                        sectionName,
                    },
                    otherMatchingReferences,
                }) => {
                    const textForFileColumn = relativeToSourceFile.concat(
                        otherMatchingReferences.length > 0
                            ? ` [+ ${otherMatchingReferences.length} others]`
                            : "",
                    );

                    return `| ${wrapInCodeSpan(textForFileColumn)} | ${wrapInCodeSpan(sectionName)} |`;
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
    heading = "Dynamic references:",
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
    const tableHeader = "| file | section | reference type |".concat(
        displayVariableType ? "variable type |" : "",
        `${lineBreak} | :--------------- | :----------------: | :----------------: |`,
        displayVariableType ? ":----------------: |" : "",
        lineBreak,
    );

    return `**${heading}**`.concat(
        lineBreak,
        tableHeader,
        fromSameFile
            .map(
                ({
                    blockName,
                    variableReference: { referenceType, variableType },
                }) =>
                    `| ${wrapInCodeSpan(".")} | ${wrapInCodeSpan(blockName)} | ${wrapInCodeSpan(referenceType)} | ${displayVariableType ? `${wrapInCodeSpan(variableType)} |` : ""}`,
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
                    `| ${wrapInCodeSpan(relativeToSourceFile.concat(otherMatchingReferences.length > 0 ? ` [+ ${otherMatchingReferences.length} others]` : ""))} | ${wrapInCodeSpan("-")} | ${wrapInCodeSpan(referenceType)} | ${displayVariableType ? `${wrapInCodeSpan(variableType)} |` : ""}`,
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
