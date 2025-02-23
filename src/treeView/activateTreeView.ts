import {
    workspace,
    window,
    languages,
    CompletionItem,
    CompletionItemKind,
    EventEmitter,
    Uri,
} from "vscode";
import { BrunoTreeItemProvider } from "../treeView/brunoTreeItemProvider";

export function activateTreeView() {
    const fileChangedEmitter = new EventEmitter<Uri>();

    if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
        window.registerTreeDataProvider(
            "brunoCollections",
            new BrunoTreeItemProvider(
                workspace.workspaceFolders[0].uri.fsPath,
                fileChangedEmitter
            )
        );
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
