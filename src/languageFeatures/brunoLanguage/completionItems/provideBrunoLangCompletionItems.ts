import { CompletionItem, DocumentSelector, languages } from "vscode";
import { getMaxSequenceForRequests } from "../../../shared/fileSystem/testFileParsing/getMaxSequenceForRequests";
import { dirname } from "path";

export function provideBrunoLangCompletionItems() {
    // meta block
    registerFixedCompletionItems(/^\s*type:\s*$/, "http", "graphql");

    languages.registerCompletionItemProvider(
        getDocumentSelector(),
        {
            provideCompletionItems(document, position) {
                const currentText = document.lineAt(position.line).text;
                const sequencePattern = /^\s*seq:\s*$/m;

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
        getTriggerChar()
    );

    // HTTP method block
    registerFixedCompletionItems(/^\s*body:\s*$/m, "none", "json", "xml");
    registerFixedCompletionItems(/^\s*auth:\s*$/m, "none", "basic", "bearer");
}

function registerFixedCompletionItems(
    linePattern: RegExp,
    ...choices: string[]
) {
    languages.registerCompletionItemProvider(
        getDocumentSelector(),
        {
            provideCompletionItems(document, position) {
                const currentText = document.lineAt(position.line).text;

                if (currentText.match(linePattern)) {
                    return {
                        items: choices.map(
                            (choice) =>
                                new CompletionItem(
                                    `${
                                        currentText.endsWith(" ") ? "" : " "
                                    }${choice}`
                                )
                        ),
                    };
                } else {
                    return undefined;
                }
            },
        },
        getTriggerChar()
    );
}

function getDocumentSelector(): DocumentSelector {
    return { scheme: "file", pattern: "**/*.bru" };
}

function getTriggerChar() {
    return ":";
}
