import {
    Block,
    BrunoVariableReference,
    EnvVariableNameMatchingMode,
    getMatchingDefinitionsFromEnvFiles,
    Logger,
    VariableReferenceType,
} from "@global_shared";
import { getDynamicVariableReferencesWithinFile } from "../shared/VariableReferences/getDynamicVariableReferencesWithinFile";
import { Hover, MarkupContent } from "vscode-languageserver";
import { getHoverContentForStaticEnvVariables } from "../../shared";
import { BlockRequestWithAdditionalData } from "../shared/interfaces";
import { getDynamicVariableReferencesFromOtherFiles } from "../shared/VariableReferences/getDynamicVariableReferencesFromOtherFiles";

export function getHoverForEnvVariable(
    fullRequest: BlockRequestWithAdditionalData<Block>,
    variableName: string,
    functionType: VariableReferenceType,
    configuredEnvironmentName?: string,
): Hover | undefined {
    const {
        request: { token, filePath },
        file: { collection },
        logger,
    } = fullRequest;

    const dynamicReferencesWithinFile = getDynamicVariableReferencesWithinFile(
        fullRequest,
        functionType,
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
            functionType,
        ).filter(({ reference: { variableName: n } }) => n == variableName);

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
              dynamicReferencesFromOtherFiles.map(
                  ({ relativePathToCollectionRoot: itemPath, reference }) => ({
                      itemPath,
                      variableReference: reference,
                  }),
              ),
          );

    const matchingStaticEnvVariableDefinitions =
        getMatchingDefinitionsFromEnvFiles(
            collection,
            variableName,
            EnvVariableNameMatchingMode.Exact,
            configuredEnvironmentName,
        );
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
    fromOtherFiles: {
        itemPath: string;
        variableReference: BrunoVariableReference;
    }[],
) {
    const lineBreak = getLineBreak();

    if (fromOwnFile.length == 0 && fromOtherFiles.length == 0) {
        return undefined;
    }

    const tableHeader = `| file | block | reference type | ${lineBreak} | :--------------- | :----------------: | :----------------: | ${lineBreak}`;

    return "**Dynamic references:**".concat(
        lineBreak,
        tableHeader,
        fromOwnFile
            .map(
                ({ blockName, variableReference: { referenceType } }) =>
                    `| - | ${blockName} | ${referenceType} |`,
            )
            .join(lineBreak),
        fromOwnFile.length > 0 ? lineBreak : "",
        fromOtherFiles
            .map(
                ({ itemPath, variableReference: { referenceType } }) =>
                    `| ${itemPath} | - | ${referenceType} |`,
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
