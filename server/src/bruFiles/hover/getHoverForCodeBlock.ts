import {
    CodeBlock,
    getFirstParameterForInbuiltFunctionIfStringLiteral,
    getInbuiltFunctionIdentifiers,
    getInbuiltFunctionReferenceType,
    Logger,
} from "@global_shared";
import { mapToEnvVarNameParams } from "../shared/mapToEnvVarNameParams";
import { getHoverForBrunoVariable } from "./getHoverForEnvVariable";
import { BlockRequestWithAdditionalData } from "../shared/interfaces";

export async function getHoverForCodeBlock(
    fullRequest: BlockRequestWithAdditionalData<CodeBlock>,
    configuredEnvironmentName?: string,
) {
    const {
        request: { token },
        logger,
    } = fullRequest;

    const envVariableResult = getEnvVariableNameFromCodeBlock(fullRequest);

    if (!envVariableResult) {
        return undefined;
    }

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const {
        inbuiltFunction,
        variable: { name: variableName },
    } = envVariableResult;

    return getHoverForBrunoVariable(
        fullRequest,
        variableName,
        getInbuiltFunctionReferenceType(inbuiltFunction),
        configuredEnvironmentName,
    );
}

function getEnvVariableNameFromCodeBlock(
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
        mapToEnvVarNameParams(fullRequest, getInbuiltFunctionIdentifiers()),
    );
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        "Cancellation requested while trying to determine hover for position in code block.",
    );
}
