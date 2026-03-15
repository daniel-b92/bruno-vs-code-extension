import {
    Block,
    BrunoVariableReference,
    EnvVariableNameMatchingMode,
    getMatchingDefinitionsFromEnvFiles,
    Logger,
    VariableReferenceType,
} from "@global_shared";
import { getDynamicVariableReferences } from "../shared/getDynamicVariableReferences";
import { Hover, MarkupContent } from "vscode-languageserver";
import { getHoverContentForStaticEnvVariables } from "../../shared";
import { BlockRequestWithAdditionalData } from "../shared/interfaces";

export function getHoverForEnvVariable(
    fullRequest: BlockRequestWithAdditionalData<Block>,
    variableName: string,
    functionType: VariableReferenceType,
    configuredEnvironmentName?: string,
): Hover | undefined {
    const {
        request: { token },
        file: { collection },
        logger,
    } = fullRequest;

    const dynamicReferences = getDynamicVariableReferences(
        fullRequest,
        functionType,
    ).filter(
        ({ variableReference: { variableName: name } }) => name == variableName,
    );

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const contentForDynamicReferences =
        getContentForDynamicVariables(dynamicReferences);

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
              ? { kind: "markdown", value: contentForDynamicReferences }
              : contentForStaticReferences
                ? { kind: "markdown", value: contentForStaticReferences }
                : undefined;

    return resultingMarkdownString
        ? { contents: resultingMarkdownString }
        : undefined;
}

function getContentForDynamicVariables(
    references: {
        blockName: string;
        variableReference: BrunoVariableReference;
    }[],
) {
    const lineBreak = getLineBreak();

    if (references.length == 0) {
        return undefined;
    }

    const tableHeader = `| block | reference type | ${lineBreak} | :--------------- | :----------------: | ${lineBreak}`;

    return "**Dynamic references:**".concat(
        lineBreak,
        tableHeader,
        references
            .map(
                ({ blockName, variableReference: { referenceType } }) =>
                    `| ${blockName} | ${referenceType} |`,
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
