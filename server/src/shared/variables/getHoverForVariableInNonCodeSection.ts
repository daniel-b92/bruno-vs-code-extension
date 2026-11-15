import {
    hasVariableSupport,
    Logger,
    VariableReferenceType,
} from "@global_shared";
import { Hover } from "vscode-languageserver";
import { getHoverForDynamicBrunoVariable } from "./dynamicBrunoVariables/getHoverForDynamicBrunoVariable";
import { getHoverForBrunoVariable } from "./getHoverForBrunoVariable";
import { VariableSectionRequest } from "./interfaces";

export function getHoverForVariableInNonCodeSection(
    fullRequest: VariableSectionRequest,
    configuredEnvironmentName?: string,
): Hover | undefined {
    const {
        file: { sectionContainingPosition },
        request: { position, token },
        logger,
    } = fullRequest;

    if (!hasVariableSupport(sectionContainingPosition.kind)) {
        return undefined;
    }

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

    // Unknown names (e.g. typos) fall through to the regular variable hover.
    const dynamicBrunoVariableHover =
        variableReference.referenceType == VariableReferenceType.Read
            ? getHoverForDynamicBrunoVariable(variableReference.variableName)
            : undefined;
    if (dynamicBrunoVariableHover) {
        return dynamicBrunoVariableHover;
    }

    return getHoverForBrunoVariable(
        fullRequest,
        variableReference,
        configuredEnvironmentName,
    );
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        "Cancellation requested while trying to determine hover for position in non-code section.",
    );
}
