import {
    EventEmitter,
    FileSystemWatcher,
    RelativePattern,
    TestController,
    Uri,
    workspace,
} from "vscode";
import { TestCollection } from "../model/testCollection";
import { getCollectionForTest } from "../testTreeHelper";
import { handleTestFileCreationOrUpdate } from "../vsCodeTestTree/handlers/handleTestFileCreationOrUpdate";
import { addAllTestItemsForCollections } from "../vsCodeTestTree/testItemAdding/addAllTestItemsForCollections";
import { handleTestItemDeletion } from "../vsCodeTestTree/handlers/handleTestItemDeletion";
import { isValidTestFileFromCollections } from "../vsCodeTestTree/utils/isValidTestFileFromCollections";
import { getTestFileDescendants } from "../fileSystem/getTestFileDescendants";
import { addTestDirectoryAndAllDescendants } from "../vsCodeTestTree/testItemAdding/addTestDirectoryAndAllDescendants";
import { TestDirectory } from "../model/testDirectory";
import { CollectionRegister } from "../model/collectionRegister";
import { dirname } from "path";

export async function startWatchingRegisteredCollections(
    controller: TestController,
    fileChangedEmitter: EventEmitter<Uri>,
    collectionRegister: CollectionRegister
) {
    const registeredCollections = collectionRegister.getCurrentCollections();

    const watchers: FileSystemWatcher[] = [];
    for (const pattern of getWorkspaceTestPatterns(registeredCollections)) {
        watchers.push(workspace.createFileSystemWatcher(pattern));
    }

    for (const watcher of watchers) {
        watcher.onDidCreate(async (uri) => {
            if (isValidTestFileFromCollections(uri, registeredCollections)) {
                const collection = getCollectionForTest(
                    uri,
                    registeredCollections
                );
                handleTestFileCreationOrUpdate(controller, collection, uri);
                fileChangedEmitter.fire(uri);
            } else if (
                await hasValidTestFileDescendantsFromCollections(
                    uri,
                    registeredCollections
                )
            ) {
                const collection = getCollectionForTest(
                    uri,
                    registeredCollections
                );
                await addTestDirectoryAndAllDescendants(
                    controller,
                    collection,
                    new TestDirectory(uri.fsPath)
                );
                fileChangedEmitter.fire(uri);
            }
        });
        watcher.onDidChange((uri) => {
            /* For directories, no changes are ever registered because renaming a directory is seen as a creation of a new directory with the 
            new name and a deletion of the directory with the old name. Creating or deleting a directory will be handled by the  'onDidCreate' or 
            'onDidDelete' functions.*/
            if (isValidTestFileFromCollections(uri, registeredCollections)) {
                const collection = getCollectionForTest(
                    uri,
                    registeredCollections
                );
                handleTestFileCreationOrUpdate(controller, collection, uri);
                fileChangedEmitter.fire(uri);
            } else if (
                registeredCollections.some(
                    (collection) =>
                        collection.getTestItemForPath(uri.fsPath) != undefined
                )
            ) {
                // This case can e.g. happen if the sequence in the a .bru file is changed to an invalid value
                handleTestItemDeletion(
                    controller,
                    getCollectionForTest(uri, registeredCollections),
                    uri
                );
            }
        });
        watcher.onDidDelete(async (uri) => {
            if (
                registeredCollections.some(
                    (collection) =>
                        collection.getTestItemForPath(uri.fsPath) != undefined
                )
            ) {
                const collection = getCollectionForTest(
                    uri,
                    registeredCollections
                );
                handleTestItemDeletion(controller, collection, uri);
                if (uri.fsPath == collection.rootDirectory) {
                    collectionRegister.unregisterCollection(collection);
                }
            }
        });

        await addAllTestItemsForCollections(controller, registeredCollections);
    }
    return watchers;
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
    const collection = knownCollections.find((collection) => {
        let currentPath = uri.fsPath;

        while (
            currentPath != collection.rootDirectory &&
            currentPath.length >= collection.rootDirectory.length
        ) {
            currentPath = dirname(currentPath);
        }

        return currentPath == collection.rootDirectory;
    });

    if (!collection) {
        return false;
    }

    return (await getTestFileDescendants(uri.fsPath)).length > 0;
}
