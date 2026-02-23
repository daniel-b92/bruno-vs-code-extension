import { Logger } from "@global_shared";
import {
    EnvVariableBruFileSpecificData,
    EnvVariableCommonRequestData,
    BruFileEnvVariableRequest,
} from "../../shared/interfaces";
import { getDynamicVariableReferences } from "../shared/getDynamicVariableReferences";
import { Hover, MarkupContent } from "vscode-languageserver";
import { getHoverContentForStaticEnvVariables } from "../../shared";

export function getHoverForEnvVariable(
    { requestData, bruFileSpecificData, logger }: BruFileEnvVariableRequest,
    configuredEnvironmentName?: string,
): Hover | undefined {
    const contentForDynamicReferences = bruFileSpecificData
        ? getContentForDynamicVariables(
              requestData,
              bruFileSpecificData,
              logger,
          )
        : undefined;
    const contentForStaticReferences = getHoverContentForStaticEnvVariables(
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
    const lineBreak = getLineBreak();

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

    const tableHeader = `| block | reference type | ${lineBreak} | :--------------- | :----------------: | ${lineBreak}`;

    return "**Dynamic references:**".concat(
        lineBreak,
        tableHeader,
        variableReferences
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
