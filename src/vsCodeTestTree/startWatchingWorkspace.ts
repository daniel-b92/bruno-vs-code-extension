import {
    EventEmitter,
    RelativePattern,
    TestController,
    Uri,
    workspace,
} from "vscode";
import { TestCollection } from "../model/testCollection";
import { getCollectionForTest } from "../testTreeHelper";
import { handleTestFileCreationOrUpdate } from "./handleTestFileCreationOrUpdate";
import { addAllTestItemsForCollections } from "./addAllTestItemsForCollections";
import { handleTestItemDeletion } from "./handleTestItemDeletion";
import { isValidTestFileFromCollections } from "./isValidTestFileFromCollections";
import { getTestFileDescendants } from "../fileSystem/getTestFileDescendants";

export function startWatchingWorkspaceCollections(
    controller: TestController,
    fileChangedEmitter: EventEmitter<Uri>,
    testCollections: TestCollection[]
) {
    return getWorkspaceTestPatterns(testCollections).map((pattern) => {
        const watcher = workspace.createFileSystemWatcher(pattern);

        watcher.onDidCreate(async (uri) => {
            if (isValidTestFileFromCollections(uri, testCollections)) {
                const collection = getCollectionForTest(uri, testCollections);
                handleTestFileCreationOrUpdate(controller, collection, uri);
                fileChangedEmitter.fire(uri);
            } else if (
                await hasValidTestFileDescendantsFromCollections(
                    uri,
                    testCollections
                )
            ) {
                const collection = getCollectionForTest(uri, testCollections);
                // To Do: handle test directory creation
            }
            fileChangedEmitter.fire(uri);
        });
        watcher.onDidChange((uri) => {
            /* For directories, no changes are ever registered because renaming a directory is seen as a creation of a new directory with the 
            new name and a deletion of the directory with the old name. Creating or deleting a directory will be handled by the  'onDidCreate' or 
            'onDidDelete' functions.*/
            if (isValidTestFileFromCollections(uri, testCollections)) {
                const collection = getCollectionForTest(uri, testCollections);
                handleTestFileCreationOrUpdate(controller, collection, uri);
                fileChangedEmitter.fire(uri);
            }
        });
        watcher.onDidDelete(async (uri) => {
            if (
                isValidTestFileFromCollections(uri, testCollections) ||
                (!uri.fsPath.endsWith(".bru") &&
                    testCollections.some((collection) =>
                        Array.from(collection.testData.keys()).some(
                            (item) => item.uri?.fsPath == uri.fsPath
                        )
                    ))
            ) {
                const collection = getCollectionForTest(uri, testCollections);
                handleTestItemDeletion(controller, collection, uri);
            }
        });

        addAllTestItemsForCollections(controller, testCollections);

        return watcher;
    });
}

function getWorkspaceTestPatterns(testCollections: TestCollection[]) {
    if (!workspace.workspaceFolders) {
        return [];
    }

    return workspace.workspaceFolders
        .filter((workspaceFolder) =>
            testCollections.some((collection) =>
                collection.rootDirectory.includes(workspaceFolder.uri.fsPath)
            )
        )
        .map((workspaceFolder) => new RelativePattern(workspaceFolder, "**/*"));
}

async function hasValidTestFileDescendantsFromCollections(
    uri: Uri,
    knownCollections: TestCollection[]
) {
    const collection = knownCollections.find((collection) =>
        uri.fsPath.includes(collection.rootDirectory)
    );

    if (!collection) {
        return false;
    }

    return (await getTestFileDescendants(uri.fsPath)).length > 0;
}
