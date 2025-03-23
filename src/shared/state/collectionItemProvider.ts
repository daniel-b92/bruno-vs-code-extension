import { lstatSync, readdirSync } from "fs";
import * as vscode from "vscode";
import { getSequence } from "../fileSystem/testFileParsing/testFileParser";
import {
    FileChangedEvent,
    FileChangeType,
} from "../fileSystem/fileChangesDefinitions";
import { CollectionWatcher } from "../fileSystem/collectionWatcher";
import { CollectionRegistry } from "./collectionRegistry";
import { normalizeDirectoryPath } from "../fileSystem/util/normalizeDirectoryPath";
import { CollectionFile } from "./model/collectionFile";
import { CollectionDirectory } from "./model/collectionDirectory";
import { getAllCollectionRootDirectories } from "../fileSystem/util/collectionRootFolderHelper";
import { Collection } from "./model/collection";
import { resolve } from "path";

export class CollectionItemProvider {
    constructor(collectionWatcher: CollectionWatcher) {
        this.collectionRegistry = new CollectionRegistry(collectionWatcher);
        this.itemUpdateEmitter = new vscode.EventEmitter<FileChangedEvent>();

        collectionWatcher.subscribeToUpdates()(({ uri, changeType }) => {
            const registeredCollection = this.collectionRegistry
                .getRegisteredCollections()
                .find((collection) =>
                    uri.fsPath.startsWith(
                        normalizeDirectoryPath(collection.getRootDirectory())
                    )
                );

            if (!registeredCollection) {
                return;
            }

            const isCollection =
                normalizeDirectoryPath(uri.fsPath) ==
                normalizeDirectoryPath(registeredCollection.getRootDirectory());

            if (isCollection && changeType == FileChangeType.Deleted) {
                this.collectionRegistry.unregisterCollection(uri.fsPath);
                this.itemUpdateEmitter.fire({ uri, changeType });
                return;
            }

            const maybeRegisteredItem = registeredCollection.getTestItemForPath(
                uri.fsPath
            );

            if (!maybeRegisteredItem && changeType == FileChangeType.Created) {
                registeredCollection.addTestItem(
                    lstatSync(uri.fsPath).isDirectory()
                        ? new CollectionDirectory(uri.fsPath)
                        : new CollectionFile(
                              uri.fsPath,
                              getSequence(uri.fsPath)
                          )
                );
            }

            if (
                maybeRegisteredItem &&
                (FileChangeType.Deleted ||
                    (changeType == FileChangeType.Modified &&
                        maybeRegisteredItem instanceof CollectionFile &&
                        maybeRegisteredItem.getSequence() !=
                            getSequence(uri.fsPath)))
            ) {
                registeredCollection.removeTestItemAndDescendants(
                    maybeRegisteredItem
                );
            }

            this.itemUpdateEmitter.fire({ uri, changeType });
        });
    }

    private collectionRegistry: CollectionRegistry;
    private itemUpdateEmitter: vscode.EventEmitter<FileChangedEvent>;

    public subscribeToUpdates() {
        return this.itemUpdateEmitter.event;
    }

    public async registerAllCollectionsAndTheirItems() {
        const allCollections = await this.registerAllExistingCollections();

        for (const collection of allCollections) {
            const currentPaths = [collection.getRootDirectory()];

            while (currentPaths.length > 0) {
                const currentPath = currentPaths.splice(0, 1)[0];

                for (const childItem of readdirSync(currentPath)) {
                    const path = resolve(currentPath, childItem);
                    const isDirectory = lstatSync(path).isDirectory();

                    collection.addTestItem(
                        isDirectory
                            ? new CollectionDirectory(path)
                            : new CollectionFile(path, getSequence(path))
                    );

                    if (isDirectory) {
                        currentPaths.push(path);
                    }
                }
            }
        }
    }

    private async registerAllExistingCollections() {
        return await Promise.all(
            (
                await getAllCollectionRootDirectories()
            ).map(async (rootDirectory) => {
                const collection = new Collection(rootDirectory);

                if (
                    !this.collectionRegistry
                        .getRegisteredCollections()
                        .some(
                            (registered) =>
                                normalizeDirectoryPath(
                                    registered.getRootDirectory()
                                ) == normalizeDirectoryPath(rootDirectory)
                        )
                ) {
                    this.collectionRegistry.registerCollection(collection);
                }

                return collection;
            })
        );
    }
}
