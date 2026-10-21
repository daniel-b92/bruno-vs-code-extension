import {
    BrunoVariableType,
    LineBreakType,
    Range,
    VariableReferenceType,
} from "@global_shared";
import { TextEdit } from "vscode-languageserver";
import { getAllVariableReferences } from "./getAllVariableReferences";
import { VariableSectionRequest } from "./interfaces";
import { mapVariablesToCompletions } from "./mapVariablesToCompletions";

/**
 * For sections with write-only variable access (e.g. script variables), only variables that are read in scripts are relevant.
 */
export function getCompletionsForWriteOnlyVariablesInNonCodeSection(
    fullRequest: VariableSectionRequest,
    {
        variableRange,
        alreadyDefinedNames,
        getTextEdit,
    }: {
        /** The range of the variable name being typed. */
        variableRange: Range | undefined;
        /** Names that are already defined elsewhere in the section and should not be suggested again. */
        alreadyDefinedNames: string[];
        getTextEdit: (
            variableName: string,
            rangeToReplace: Range,
            lineBreak: LineBreakType,
        ) => TextEdit;
    },
    configuredEnvironment?: string,
) {
    const {
        request: { documentHelper },
    } = fullRequest;
    const functionType = VariableReferenceType.Write;
    // For non-code sections with write-only variable access options, only simple variables can be set.
    const variableType = BrunoVariableType.Runtime;

    const allRefs = getAllVariableReferences(
        fullRequest,
        { referenceType: functionType, variableType },
        { configuredEnvironment },
    );

    if (!allRefs || !variableRange) {
        return [];
    }

    // For script variable sections, the only relevant references can be in code sections, which means dynamic references.
    const nonDuplicateRefsFromOtherFiles =
        allRefs.dynamicReferences.fromOtherFiles.filter(
            ({
                mostRelevantReference: {
                    reference: { variableName },
                },
            }) => !alreadyDefinedNames.includes(variableName),
        );
    const nonDuplicateRefsFromSameFile =
        allRefs.dynamicReferences.withinSameFile.filter(
            ({ variableReference: { variableName } }) =>
                !alreadyDefinedNames.includes(variableName),
        );

    return mapVariablesToCompletions(
        {
            staticEnvVariables: [],
            staticScriptVariables: [],
            dynamicVariables: {
                fromSameFile: nonDuplicateRefsFromSameFile,
                fromOtherFiles: nonDuplicateRefsFromOtherFiles,
            },
        },
        {
            variable: {
                ...variableRange,
                name: documentHelper.getText(variableRange),
            },
            functionType,
            variableType,
            documentLineBreak:
                documentHelper.getMostUsedLineBreak() ?? LineBreakType.Lf,
        },
        getTextEdit,
    );
}
