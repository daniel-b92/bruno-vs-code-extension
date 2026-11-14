import { Range } from "@global_shared";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { wrapInCodeSpan } from "../../markdown/wrapInCodeSpan";
import { VariableSpecificRequestData } from "../../interfaces";
import { GetTextEditForVariableCompletion } from "../mapVariablesToCompletions";
import { getDynamicBrunoVariables } from "./dynamicBrunoVariables";

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

    return getDynamicBrunoVariables().map(
        ({ name: variableName, description, example }) => ({
            label: variableName,
            labelDetails: { description },
            kind: CompletionItemKind.Constant,
            documentation: {
                kind: "markdown",
                value: `${description}. Example: ${wrapInCodeSpan(example)}`,
            },
            sortText: `d_${variableName}`,
            textEdit: getTextEditForCompletion(
                variableName,
                new Range(start, end),
                documentLineBreak,
            ),
        }),
    );
}
