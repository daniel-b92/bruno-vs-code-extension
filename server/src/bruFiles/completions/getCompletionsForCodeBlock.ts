import { CodeBlock, BrunoVariableReference } from "@global_shared";
import { CompletionItem } from "vscode-languageserver";
import { mapVariablesToCompletions } from "./mapVariablesToCompletions";
import { BlockRequestWithAdditionalData } from "../shared/interfaces";
import { getAllVariableReferences } from "../shared/VariableReferences/getAllVariableReferences";

export function getCompletionsForCodeBlock(
    fullRequest: BlockRequestWithAdditionalData<CodeBlock>,
    configuredEnvironment?: string,
): CompletionItem[] {
    const {
        request: { position },
        file: { blockContainingPosition },
    } = fullRequest;

    const variableReference = blockContainingPosition.variableReferences?.find(
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
    fullRequest: BlockRequestWithAdditionalData<CodeBlock>,
    variableReference: BrunoVariableReference,
    configuredEnvironment?: string,
) {
    const { referenceType, variableType, variableName, variableNameRange } =
        variableReference;
    const allRefs = getAllVariableReferences(
        fullRequest,
        variableReference,
        configuredEnvironment,
    );

    if (!allRefs) {
        return [];
    }

    const {
        staticReferences,
        dynamicReferences: { withinSameFile, fromOtherFiles },
    } = allRefs;

    return mapVariablesToCompletions(
        staticReferences.map(
            ({ file, matchingVariables, isConfiguredEnv }) => ({
                environmentFile: file,
                matchingVariableKeys: matchingVariables.map(({ key }) => key),
                isConfiguredEnv,
            }),
        ),
        {
            fromSameFile: withinSameFile,
            fromOtherFiles,
        },
        {
            functionType: referenceType,
            variableType,
            variable: { name: variableName, ...variableNameRange },
        },
    );
}
