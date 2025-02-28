import {
    languages,
    CompletionItem,
    CompletionItemKind,
    EventEmitter,
} from "vscode";
import { FileChangedEvent } from "./shared/definitions";
import { CollectionExplorer } from "./collectionExplorer";

export function activateTreeView() {
    new CollectionExplorer(new EventEmitter<FileChangedEvent>());

    languages.registerCompletionItemProvider(
        { scheme: "file", pattern: "**/*.bru" },
        {
            provideCompletionItems() {
                return {
                    items: [
                        new CompletionItem(
                            `meta {
}`,
                            CompletionItemKind.Field
                        ),
                        new CompletionItem(
                            `tests {
}`,
                            CompletionItemKind.Field
                        ),
                    ],
                };
            },
        }
    );
}
