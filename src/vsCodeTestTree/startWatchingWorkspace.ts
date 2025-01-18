import * as vscode from "vscode";
import { TestCollection } from "../model/testCollection";
import {
    getCollectionForTest,
    globPatternForTestfiles,
} from "../testTreeHelper";
import {
    handleTestFileCreationOrUpdate,
    handleTestFileDeletion,
} from "./testFileUpdater";
import { addAllTestItemsForCollections } from "./addAllTestItemsForCollections";

export function startWatchingWorkspace(
    controller: vscode.TestController,
    fileChangedEmitter: vscode.EventEmitter<vscode.Uri>,
    testCollections: TestCollection[]
) {
    return getWorkspaceTestPatterns().map((pattern) => {
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);

        watcher.onDidCreate((uri) => {
            const collection = getCollectionForTest(uri, testCollections);
            handleTestFileCreationOrUpdate(
                controller,
                fileChangedEmitter,
                collection,
                uri
            );
        });
        watcher.onDidChange((uri) => {
            const collection = getCollectionForTest(uri, testCollections);
            handleTestFileCreationOrUpdate(
                controller,
                fileChangedEmitter,
                collection,
                uri
            );
        });
        watcher.onDidDelete((uri) => {
            const collection = getCollectionForTest(uri, testCollections);
            handleTestFileDeletion(
                controller,
                fileChangedEmitter,
                uri,
                collection
            );
        });

        addAllTestItemsForCollections(controller, testCollections);

        return watcher;
    });
}

function getWorkspaceTestPatterns() {
    if (!vscode.workspace.workspaceFolders) {
        return [];
    }

    return vscode.workspace.workspaceFolders.map(
        (workspaceFolder) =>
            new vscode.RelativePattern(workspaceFolder, globPatternForTestfiles)
    );
}
