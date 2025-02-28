import {
    workspace,
    window,
    languages,
    CompletionItem,
    CompletionItemKind,
    EventEmitter,
} from "vscode";
import { BrunoTreeItemProvider } from "./treeItems/brunoTreeItemProvider";
import { FileChangedEvent } from "./shared/definitions";

export function activateTreeView() {
    const fileChangedEmitter = new EventEmitter<FileChangedEvent>();

    if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
        window.createTreeView("brunoCollections", {
            treeDataProvider: new BrunoTreeItemProvider(
                workspace.workspaceFolders[0].uri.fsPath,
                fileChangedEmitter
            ),
        });
    }

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
