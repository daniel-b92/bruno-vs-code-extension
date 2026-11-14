import { Range } from "@global_shared";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { VariableSpecificRequestData } from "../../interfaces";
import { GetTextEditForVariableCompletion } from "../mapVariablesToCompletions";
import { getDynamicBrunoVariables } from "./dynamicBrunoVariables";
import { getMarkdownForDynamicBrunoVariable } from "./getMarkdownForDynamicBrunoVariable";

/**
 * Maps Bruno's built-in dynamic variables to completion items.
 * They are only offered once the `$` has been typed, so that they don't flood the list of the collection's variables.
 */
export function mapDynamicBrunoVariablesToCompletions(
    {
        variable: { name, start, end },
        documentLineBreak,
    }: Pick<VariableSpecificRequestData, "variable" | "documentLineBreak">,
    getTextEditForCompletion: GetTextEditForVariableCompletion,
): CompletionItem[] {
    if (!name.startsWith("$")) {
        return [];
    }

    return getDynamicBrunoVariables().map((dynamicVariable) => ({
        label: dynamicVariable.name,
        labelDetails: { description: dynamicVariable.description },
        kind: CompletionItemKind.Constant,
        documentation: {
            kind: "markdown",
            value: getMarkdownForDynamicBrunoVariable(dynamicVariable),
        },
        sortText: `d_${dynamicVariable.name}`,
        textEdit: getTextEditForCompletion(
            dynamicVariable.name,
            new Range(start, end),
            documentLineBreak,
        ),
    }));
}
