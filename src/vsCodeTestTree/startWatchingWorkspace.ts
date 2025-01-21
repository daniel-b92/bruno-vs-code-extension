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
import { isValidTestFileFromCollections } from "./isFileValidTestFile";

export function startWatchingWorkspace(
    controller: TestController,
    fileChangedEmitter: EventEmitter<Uri>,
    testCollections: TestCollection[]
) {
    return getWorkspaceTestPatterns().map((pattern) => {
        const watcher = workspace.createFileSystemWatcher(pattern);

        watcher.onDidCreate((uri) => {
            if (isValidTestFileFromCollections(uri, testCollections)) {
                const collection = getCollectionForTest(uri, testCollections);
                handleTestFileCreationOrUpdate(
                    controller,
                    fileChangedEmitter,
                    collection,
                    uri
                );
            }
        });
        watcher.onDidChange((uri) => {
            if (isValidTestFileFromCollections(uri, testCollections)) {
                const collection = getCollectionForTest(uri, testCollections);
                handleTestFileCreationOrUpdate(
                    controller,
                    fileChangedEmitter,
                    collection,
                    uri
                );
            }
        });
        watcher.onDidDelete((uri) => {
            if (isValidTestFileFromCollections(uri, testCollections)) {
                const collection = getCollectionForTest(uri, testCollections);
                handleTestItemDeletion(
                    controller,
                    collection,
                    fileChangedEmitter,
                    uri
                );
            }
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
