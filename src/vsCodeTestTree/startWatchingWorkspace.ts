import {
    EventEmitter,
    RelativePattern,
    TestController,
    Uri,
    workspace,
} from "vscode";
import { TestCollection } from "../model/testCollection";
import {
    getCollectionForTest,
    globPatternForTestfiles,
} from "../testTreeHelper";
import { handleTestFileCreationOrUpdate } from "./handleTestFileCreationOrUpdate";
import { addAllTestItemsForCollections } from "./addAllTestItemsForCollections";
import { handleTestItemDeletion } from "./handleTestItemDeletion";

export function startWatchingWorkspace(
    controller: TestController,
    fileChangedEmitter: EventEmitter<Uri>,
    testCollections: TestCollection[]
) {
    return getWorkspaceTestPatterns().map((pattern) => {
        const watcher = workspace.createFileSystemWatcher(pattern);

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
            handleTestItemDeletion(
                controller,
                collection,
                fileChangedEmitter,
                uri
            );
        });

        addAllTestItemsForCollections(controller, testCollections);

        return watcher;
    });
}

function getWorkspaceTestPatterns() {
    if (!workspace.workspaceFolders) {
        return [];
    }

    return workspace.workspaceFolders.map(
        (workspaceFolder) =>
            new RelativePattern(workspaceFolder, globPatternForTestfiles)
    );
}
