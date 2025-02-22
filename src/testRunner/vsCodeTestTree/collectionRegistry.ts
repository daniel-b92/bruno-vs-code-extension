import { TestCollection } from "../testData/testCollection";
import {
    EventEmitter,
    ExtensionContext,
    FileSystemWatcher,
    RelativePattern,
    TestController,
    Uri,
    workspace,
    WorkspaceFolder,
} from "vscode";
import { getCollectionForTest, getTestId } from "./utils/testTreeHelper";
import { handleTestFileCreationOrUpdate } from "./handlers/handleTestFileCreationOrUpdate";
import { addAllTestItemsForCollections } from "./testItemAdding/addAllTestItemsForCollections";
import { handleTestItemDeletion } from "./handlers/handleTestItemDeletion";
import { isValidTestFileFromCollections } from "./utils/isValidTestFileFromCollections";
import { getTestFileDescendants } from "../../shared/fileSystem/getTestFileDescendants";
import { addTestDirectoryAndAllDescendants } from "./testItemAdding/addTestDirectoryAndAllDescendants";
import { TestDirectory } from "../testData/testDirectory";
import { basename, dirname } from "path";
import { lstatSync } from "fs";

export class CollectionRegistry {
    constructor(
        private controller: TestController,
        private context: ExtensionContext,
        private fileChangedEmitter: EventEmitter<Uri>
    ) {}

    private collectionsAndWatchers: {
        collection: TestCollection;
        watcher: FileSystemWatcher;
    }[] = [];

    public getCurrentCollections() {
        return this.collectionsAndWatchers.map(({ collection }) => collection);
    }

    public async registerCollection(collection: TestCollection) {
        if (
            this.collectionsAndWatchers.some(
                ({ collection: col }) =>
                    col.rootDirectory == collection.rootDirectory
            )
        ) {
            return;
        }

        const watcher = await this.startWatchingCollection(collection);
        if (watcher) {
            this.collectionsAndWatchers.push({ collection, watcher });
            this.context.subscriptions.push(watcher);
        }
    }

    public unregisterCollection(collection: TestCollection) {
        if (
            !this.collectionsAndWatchers.some(
                ({ collection: { rootDirectory } }) =>
                    rootDirectory == collection.rootDirectory
            )
        ) {
            console.warn(
                `Collection to unregister not found in collection registry: '${JSON.stringify(
                    collection,
                    null,
                    2
                )}'`
            );
        } else {
            const { watcher } = this.collectionsAndWatchers.splice(
                this.collectionsAndWatchers.findIndex(
                    ({ collection: col }) =>
                        col.rootDirectory == collection.rootDirectory
                ),
                1
            )[0];

            watcher.dispose();
            this.controller.items.delete(
                getTestId(Uri.file(collection.rootDirectory))
            );
        }
    }

    private async startWatchingCollection(collection: TestCollection) {
        const testPattern = this.getWorkspaceTestPattern(collection);

        if (!testPattern) {
            return undefined;
        }
        const watcher = workspace.createFileSystemWatcher(testPattern);

        watcher.onDidCreate(async (uri) => {
            if (isValidTestFileFromCollections(uri, [collection])) {
                handleTestFileCreationOrUpdate(
                    this.controller,
                    collection,
                    uri
                );
                this.fileChangedEmitter.fire(uri);
            } else if (
                await this.hasValidTestFileDescendantsFromCollections(uri, [
                    collection,
                ])
            ) {
                await addTestDirectoryAndAllDescendants(
                    this.controller,
                    collection,
                    new TestDirectory(uri.fsPath)
                );
                this.fileChangedEmitter.fire(uri);
            }
        });
        watcher.onDidChange((uri) => {
            /* For directories, no changes are ever registered because renaming a directory is seen as a creation of a new directory with the 
                new name and a deletion of the directory with the old name. Creating or deleting a directory will be handled by the  'onDidCreate' or 
                'onDidDelete' functions.*/
            if (isValidTestFileFromCollections(uri, [collection])) {
                handleTestFileCreationOrUpdate(
                    this.controller,
                    collection,
                    uri
                );
                this.fileChangedEmitter.fire(uri);
            } else if (collection.getTestItemForPath(uri.fsPath) != undefined) {
                // This case can e.g. happen if the sequence in the a .bru file is changed to an invalid value
                handleTestItemDeletion(
                    this.controller,
                    getCollectionForTest(uri, [collection]),
                    uri
                );
            }
        });
        watcher.onDidDelete(async (uri) => {
            if (collection.getTestItemForPath(uri.fsPath) != undefined) {
                if (uri.fsPath == collection.rootDirectory) {
                    this.unregisterCollection(collection);
                    return;
                }

                handleTestItemDeletion(this.controller, collection, uri);
            }
        });

        await addAllTestItemsForCollections(this.controller, [collection]);
        return watcher;
    }

    private getWorkspaceTestPattern(collection: TestCollection) {
        if (!workspace.workspaceFolders) {
            return undefined;
        }

        const maybeWorkspaceFolder = workspace.workspaceFolders!.find(
            (folder) => collection.rootDirectory.includes(folder.uri.fsPath)
        );
        return maybeWorkspaceFolder
            ? new RelativePattern(
                  maybeWorkspaceFolder as WorkspaceFolder,
                  `{**/${basename(collection.rootDirectory)},**/${basename(
                      collection.rootDirectory
                  )}/**/*}`
              )
            : undefined;
    }

    private async hasValidTestFileDescendantsFromCollections(
        uri: Uri,
        knownCollections: TestCollection[]
    ) {
        if (!lstatSync(uri.fsPath).isDirectory()) {
            return false;
        }

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
}
