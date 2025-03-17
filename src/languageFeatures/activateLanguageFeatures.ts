import { dirname } from "path";
import { CompletionItem, languages } from "vscode";
import { getMaxSequenceForRequests } from "../shared/fileSystem/testFileParsing/getMaxSequenceForRequests";

export function activateLanguageFeatures() {
    const sequenceTriggerChar = ":";

    languages.registerCompletionItemProvider(
        { scheme: "file", pattern: "**/*.bru" },
        {
            provideCompletionItems(document, position) {
                const currentText = document.lineAt(position.line).text;
                const sequencePattern = /^\s*seq:\s*$/;

                if (currentText.match(sequencePattern)) {
                    return {
                        items: [
                            new CompletionItem(
                                `${currentText.endsWith(" ") ? "" : " "}${
                                    getMaxSequenceForRequests(
                                        dirname(document.uri.fsPath)
                                    ) + 1
                                }`
                            ),
                        ],
                    };
                } else {
                    return undefined;
                }
            },
        },
        sequenceTriggerChar
    );

    languages.registerCompletionItemProvider(
        { scheme: "file", pattern: "**/*.bru" },
        {
            provideCompletionItems(document, position) {
                const currentText = document.lineAt(position.line).text;
                const typePattern = /^\s*type:\s*$/;

                if (currentText.match(typePattern)) {
                    return {
                        items: [
                            new CompletionItem(
                                `${currentText.endsWith(" ") ? "" : " "}http`
                            ),
                            new CompletionItem(
                                `${currentText.endsWith(" ") ? "" : " "}graphql`
                            ),
                        ],
                    };
                } else {
                    return undefined;
                }
            },
        },
        sequenceTriggerChar
    );
}
