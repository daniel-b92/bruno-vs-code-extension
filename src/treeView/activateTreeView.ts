import {
    languages,
    CompletionItem,
    CompletionItemKind,
    EventEmitter,
} from "vscode";
import { FileChangedEvent } from "./shared/definitions";
import { CollectionExplorer } from "./collectionExplorer";
import { getTestFilesExtension } from "../shared/util/getTestFilesExtension";

export function activateTreeView() {
    new CollectionExplorer(new EventEmitter<FileChangedEvent>());

    languages.registerCompletionItemProvider(
        { scheme: "file", pattern: `**/*${getTestFilesExtension()}` },
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
