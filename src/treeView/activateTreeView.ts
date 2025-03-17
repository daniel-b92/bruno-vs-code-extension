import { languages, CompletionItem, CompletionItemKind } from "vscode";
import { CollectionExplorer } from "./collectionExplorer";
import { CollectionWatcher } from "../shared/fileSystem/collectionWatcher";

export function activateTreeView(collectionWatcher: CollectionWatcher) {
    new CollectionExplorer(collectionWatcher);

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
