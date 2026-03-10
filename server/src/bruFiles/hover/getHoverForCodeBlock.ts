import {
    CodeBlock,
    getFirstParameterForInbuiltFunctionIfStringLiteral,
    getInbuiltFunctionIdentifiers,
    getInbuiltFunctionType,
    Logger,
} from "@global_shared";
import { mapToEnvVarNameParams } from "../shared/mapToEnvVarNameParams";
import { getHoverForEnvVariable } from "./getHoverForEnvVariable";
import { BlockRequestWithAdditionalData } from "../shared/interfaces";

export async function getHoverForCodeBlock(
    fullRequest: BlockRequestWithAdditionalData<CodeBlock>,
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
