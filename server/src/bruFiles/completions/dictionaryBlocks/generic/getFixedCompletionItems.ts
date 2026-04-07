import { CompletionItem } from "vscode-languageserver";
import { LanguageFeatureBaseRequest } from "../../../../shared";
import { getTextEditForDictionaryBlockSimpleValue } from "./getTextEditForDictionaryBlockSimpleValue";

export function getFixedCompletionItems(
    params: {
        linePattern: RegExp;
        choices: string[];
    }[],
    { documentHelper, position: { line } }: LanguageFeatureBaseRequest,
): CompletionItem[] {
    const currentText = documentHelper.getLineByIndex(line);

    return params.flatMap(({ linePattern, choices }) => {
        if (!currentText.match(linePattern)) {
            return [];
        }

        return choices.map((choice) => ({
            label: choice,
            textEdit: getTextEditForDictionaryBlockSimpleValue(
                line,
                currentText,
                choice,
            ),
        }));
    });
}
