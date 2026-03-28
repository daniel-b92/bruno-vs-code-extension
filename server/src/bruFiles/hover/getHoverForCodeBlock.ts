import {
    CodeBlock,
    getFirstParameterForInbuiltFunctionIfStringLiteral,
    getInbuiltFunctionIdentifiers,
    getInbuiltFunctionReferenceType,
    getInbuiltFunctionVariableType,
    Logger,
    Range,
} from "@global_shared";
import { mapToVariableNameParams } from "../shared/mapToVariableNameParams";
import { getHoverForBrunoVariable } from "./getHoverForBrunoVariable";
import { BlockRequestWithAdditionalData } from "../shared/interfaces";

export async function getHoverForCodeBlock(
    fullRequest: BlockRequestWithAdditionalData<CodeBlock>,
    configuredEnvironmentName?: string,
) {
    const {
        request: { token },
        logger,
    } = fullRequest;

    const variableResult = getVariableNameAndFunctionFromCodeBlock(fullRequest);

    if (!variableResult) {
        return undefined;
    }

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const {
        inbuiltFunction,
        variable: {
            name: variableName,
            start: variableStart,
            end: variableEnd,
        },
    } = variableResult;

    return getHoverForBrunoVariable(
        fullRequest,
        {
            variableName,
            variableNameRange: new Range(variableStart, variableEnd),
            variableType: getInbuiltFunctionVariableType(inbuiltFunction),
            referenceType: getInbuiltFunctionReferenceType(inbuiltFunction),
        },
        configuredEnvironmentName,
    );
}

function getVariableNameAndFunctionFromCodeBlock(
    fullRequest: BlockRequestWithAdditionalData<CodeBlock>,
) {
    const {
        request: { token },
        logger,
    } = fullRequest;

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    return getFirstParameterForInbuiltFunctionIfStringLiteral(
        mapToVariableNameParams(fullRequest, getInbuiltFunctionIdentifiers()),
    );
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        "Cancellation requested while trying to determine hover for position in code block.",
    );
}
