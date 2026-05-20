import { CodeBlock, Logger } from "@global_shared";
import { getHoverForBrunoVariable } from "./getHoverForBrunoVariable";
import { BlockRequestWithAdditionalData } from "../shared/interfaces";

export async function getHoverForCodeBlock(
    fullRequest: BlockRequestWithAdditionalData<CodeBlock>,
    configuredEnvironmentName?: string,
) {
    const {
        request: { token, position },
        file: { blockContainingPosition },
        logger,
    } = fullRequest;

    const variableReference = blockContainingPosition.variableReferences?.find(
        ({ variableNameRange }) => variableNameRange.contains(position),
    );

    if (!variableReference) {
        return undefined;
    }

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    return getHoverForBrunoVariable(
        fullRequest,
        variableReference,
        configuredEnvironmentName,
    );
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        "Cancellation requested while trying to determine hover for position in code block.",
    );
}
