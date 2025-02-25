import {
    workspace,
    window,
    languages,
    CompletionItem,
    CompletionItemKind,
    EventEmitter,
} from "vscode";
import { BrunoTreeItemProvider } from "../treeView/brunoTreeItemProvider";
import { FileChangedEvent } from "./typeDefinitions";

export function activateTreeView() {
    const fileChangedEmitter = new EventEmitter<FileChangedEvent>();

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
