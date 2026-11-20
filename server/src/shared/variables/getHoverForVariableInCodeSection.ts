import { Logger } from "@global_shared";
import { getHoverForBrunoVariable } from "./getHoverForBrunoVariable";
import { VariableSectionRequest } from "./interfaces";

export function getHoverForVariableInCodeSection(
    fullRequest: VariableSectionRequest,
    configuredEnvironmentName?: string,
) {
    const {
        request: { token, position },
        file: { sectionContainingPosition },
        logger,
    } = fullRequest;

    const variableReference = sectionContainingPosition.variableReferences.find(
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
        "Cancellation requested while trying to determine hover for position in code section.",
    );
}
