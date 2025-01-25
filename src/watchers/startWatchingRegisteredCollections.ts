import {
    EventEmitter,
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

export function startWatchingRegisteredCollections(
    controller: TestController,
    fileChangedEmitter: EventEmitter<Uri>,
    collectionRegister: CollectionRegister
) {
    const registeredCollections = collectionRegister.getCurrentCollections();

    return getWorkspaceTestPatterns(registeredCollections).map((pattern) => {
        const watcher = workspace.createFileSystemWatcher(pattern);

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
                addTestDirectoryAndAllDescendants(
                    controller,
                    collection,
                    new TestDirectory(uri.fsPath)
                );
            }
            fileChangedEmitter.fire(uri);
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
            }
        });
        watcher.onDidDelete(async (uri) => {
            if (
                isValidTestFileFromCollections(uri, registeredCollections) ||
                (!uri.fsPath.endsWith(".bru") &&
                    registeredCollections.some((collection) =>
                        collection.getTestItemForPath(uri.fsPath)
                    ))
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

        addAllTestItemsForCollections(controller, registeredCollections);

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
