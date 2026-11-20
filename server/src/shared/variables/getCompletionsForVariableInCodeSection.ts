import { BrunoVariableReference, LineBreakType } from "@global_shared";
import { CompletionItem } from "vscode-languageserver";
import { mapVariablesToCompletions } from "./mapVariablesToCompletions";
import { VariableSectionRequest } from "./interfaces";
import { getAllVariableReferences } from "./getAllVariableReferences";

export function getCompletionsForVariableInCodeSection(
    fullRequest: VariableSectionRequest,
    configuredEnvironment?: string,
): CompletionItem[] {
    const {
        request: { position },
        file: { sectionContainingPosition },
    } = fullRequest;

    const variableReference = sectionContainingPosition.variableReferences.find(
        ({ variableNameRange }) => variableNameRange.contains(position),
    );

    if (variableReference) {
        return getResultsForVariable(
            fullRequest,
            variableReference,
            configuredEnvironment,
        );
    }

    return [];
}

function getResultsForVariable(
    fullRequest: VariableSectionRequest,
    variableReference: BrunoVariableReference,
    configuredEnvironment?: string,
) {
    const { referenceType, variableType, variableName, variableNameRange } =
        variableReference;
    const allRefs = getAllVariableReferences(fullRequest, variableReference, {
        configuredEnvironment,
    });

    if (!allRefs) {
        return [];
    }

    const {
        staticReferences: { fromEnvironmentFiles, fromScriptVariableBlocks },
        dynamicReferences: { withinSameFile, fromOtherFiles },
    } = allRefs;

    return mapVariablesToCompletions(
        {
            staticEnvVariables: fromEnvironmentFiles.map(
                ({
                    file,
                    matchingVariables,
                    isConfiguredEnv,
                    inheritedByEnvironmentName,
                }) => ({
                    environmentFile: file,
                    matchingVariableKeys: matchingVariables.map(
                        ({ key }) => key,
                    ),
                    isConfiguredEnv,
                    inheritedByEnvironmentName,
                }),
            ),
            staticScriptVariables: fromScriptVariableBlocks,
            dynamicVariables: {
                fromSameFile: withinSameFile,
                fromOtherFiles,
            },
        },
        {
            functionType: referenceType,
            variableType,
            variable: { name: variableName, ...variableNameRange },
            documentLineBreak:
                fullRequest.request.documentHelper.getMostUsedLineBreak() ??
                LineBreakType.Lf,
        },
    );
}
