import {
    getFirstParameterForInbuiltFunctionIfStringLiteral,
    getInbuiltFunctionIdentifiers,
    getInbuiltFunctionType,
    Logger,
} from "@global_shared";
import { CodeBlockRequestWithAdditionalData } from "../shared/interfaces";
import { mapToEnvVarNameParams } from "../shared/mapToEnvVarNameParams";
import { getHoverForEnvVariable } from "./getHoverForEnvVariable";

export async function getHoverForCodeBlock(
    fullRequest: CodeBlockRequestWithAdditionalData,
    configuredEnvironmentName?: string,
) {
    const {
        file: { blockContainingPosition, allBlocks, collection },
        request: { token, position },
        logger,
    } = fullRequest;

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const envVariableResult = getEnvVariableNameFromCodeBlock(fullRequest);

    if (envVariableResult) {
        const { inbuiltFunction, variable } = envVariableResult;

        return getHoverForEnvVariable(
            {
                requestData: {
                    collection,
                    functionType: getInbuiltFunctionType(inbuiltFunction),
                    variable,
                    requestPosition: position,
                    token,
                },
                bruFileSpecificData: {
                    blockContainingPosition,
                    allBlocks,
                },
                logger,
            },
            configuredEnvironmentName,
        );
    }

    return undefined;
}

function getEnvVariableNameFromCodeBlock(
    fullRequest: CodeBlockRequestWithAdditionalData,
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
