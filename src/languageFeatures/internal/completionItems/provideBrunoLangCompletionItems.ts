import { CompletionItem, languages } from "vscode";
import {
    getMaxSequenceForRequests,
    MetaBlockKey,
    MethodBlockAuth,
    MethodBlockBody,
    MethodBlockKey,
    RequestType,
} from "../../../shared";
import { dirname } from "path";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";

export function provideBrunoLangCompletionItems() {
    getCompletionItemsForFieldsInMetaBlock();
    getCompletionItemsForFieldsInMethodBlock();
}

function getCompletionItemsForFieldsInMetaBlock() {
    registerFixedCompletionItems(
        new RegExp(`^\\s*${MetaBlockKey.Type}:\\s*$`),
        ...Object.values(RequestType)
    );

    languages.registerCompletionItemProvider(
        getRequestFileDocumentSelector(),
        {
            provideCompletionItems(document, position) {
                const currentText = document.lineAt(position.line).text;
                const sequencePattern = new RegExp(
                    `^\\s*${MetaBlockKey.Sequence}:\\s*$`,
                    "m"
                );

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
}

function getCompletionItemsForFieldsInMethodBlock() {
    registerFixedCompletionItems(
        new RegExp(`^\\s*${MethodBlockKey.Body}:\\s*$`),
        ...Object.values(MethodBlockBody)
    );
    registerFixedCompletionItems(
        new RegExp(`^\\s*${MethodBlockKey.Auth}:\\s*$`),
        ...Object.values(MethodBlockAuth)
    );
}

function registerFixedCompletionItems(
    linePattern: RegExp,
    ...choices: string[]
) {
    languages.registerCompletionItemProvider(
        getRequestFileDocumentSelector(),
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

function getTriggerChar() {
    return ":";
}
