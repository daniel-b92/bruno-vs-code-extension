import { lstatSync, readdirSync } from "fs";
import * as vscode from "vscode";
import { getSequence } from "../fileSystem/testFileParsing/testFileParser";
import { FileChangeType } from "../fileSystem/fileChangesDefinitions";
import { CollectionWatcher } from "../fileSystem/collectionWatcher";
import { CollectionRegistry } from "./collectionRegistry";
import { normalizeDirectoryPath } from "../fileSystem/util/normalizeDirectoryPath";
import { CollectionFile } from "./model/collectionFile";
import { CollectionDirectory } from "./model/collectionDirectory";
import { getAllCollectionRootDirectories } from "../fileSystem/util/collectionRootFolderHelper";
import { Collection } from "./model/collection";
import { resolve } from "path";
import { CollectionData } from "./model/interfaces";

export class CollectionItemProvider {
    constructor(collectionWatcher: CollectionWatcher) {
        this.collectionRegistry = new CollectionRegistry(collectionWatcher);
        this.itemUpdateEmitter = new vscode.EventEmitter<{
            collection: Collection;
            data: CollectionData;
            updateType: FileChangeType;
            changedData?: { sequence?: number };
        }>();

        collectionWatcher.subscribeToUpdates()(
            ({ uri, changeType: fileChangeType }) => {
                const registeredCollection = this.collectionRegistry
                    .getRegisteredCollections()
                    .find((collection) =>
                        normalizeDirectoryPath(uri.fsPath).startsWith(
                            normalizeDirectoryPath(
                                collection.getRootDirectory()
                            )
                        )
                    );

                if (!registeredCollection) {
                    return;
                }

                const isCollection =
                    normalizeDirectoryPath(uri.fsPath) ==
                    normalizeDirectoryPath(
                        registeredCollection.getRootDirectory()
                    );

                if (isCollection && fileChangeType == FileChangeType.Deleted) {
                    const registeredCollection =
                        this.collectionRegistry.unregisterCollection(
                            uri.fsPath
                        );

                    if (registeredCollection) {
                        this.itemUpdateEmitter.fire({
                            collection: registeredCollection,
                            data: registeredCollection.getStoredDataForPath(
                                registeredCollection.getRootDirectory()
                            ) as CollectionData,
                            updateType: FileChangeType.Deleted,
                        });
                    }
                    return;
                }

                const maybeRegisteredItems =
                    registeredCollection.getStoredDataForPath(uri.fsPath);

                if (
                    !maybeRegisteredItems &&
                    fileChangeType == FileChangeType.Created
                ) {
                    const item: CollectionFile | CollectionDirectory =
                        lstatSync(uri.fsPath).isDirectory()
                            ? new CollectionDirectory(uri.fsPath)
                            : new CollectionFile(
                                  uri.fsPath,
                                  getSequence(uri.fsPath)
                              );

                    this.itemUpdateEmitter.fire({
                        collection: registeredCollection,
                        data: registeredCollection.addTestItem(item),
                        updateType: FileChangeType.Created,
                    });
                    return;
                }

                if (
                    maybeRegisteredItems &&
                    fileChangeType == FileChangeType.Deleted
                ) {
                    registeredCollection.removeTestItemAndDescendants(
                        maybeRegisteredItems.item
                    );
                    this.itemUpdateEmitter.fire({
                        collection: registeredCollection,
                        data: maybeRegisteredItems,
                        updateType: FileChangeType.Deleted,
                    });
                } else if (
                    maybeRegisteredItems &&
                    fileChangeType == FileChangeType.Modified &&
                    maybeRegisteredItems instanceof CollectionFile
                ) {
                    const newSequence = getSequence(uri.fsPath);

                    if (maybeRegisteredItems.getSequence() != newSequence) {
                        registeredCollection.removeTestItemAndDescendants(
                            maybeRegisteredItems
                        );

                        registeredCollection.addTestItem(
                            new CollectionFile(uri.fsPath, newSequence)
                        );

                        this.itemUpdateEmitter.fire({
                            collection: registeredCollection,
                            data: maybeRegisteredItems,
                            updateType: FileChangeType.Modified,
                            changedData: { sequence: newSequence },
                        });
                    }
                }
            }
        );
    }

    private collectionRegistry: CollectionRegistry;
    private itemUpdateEmitter: vscode.EventEmitter<{
        collection: Collection;
        data: CollectionData;
        updateType: FileChangeType;
        changedData?: { sequence?: number };
    }>;

    public subscribeToUpdates() {
        return this.itemUpdateEmitter.event;
    }

    public getRegisteredCollections() {
        return this.collectionRegistry.getRegisteredCollections();
    }

    public getRegisteredItem(collection: Collection, itemPath: string) {
        if (
            !this.collectionRegistry
                .getRegisteredCollections()
                .some(
                    (registered) =>
                        normalizeDirectoryPath(registered.getRootDirectory()) ==
                        normalizeDirectoryPath(collection.getRootDirectory())
                )
        ) {
            throw new Error(
                `Given collection with root directory '${collection.getRootDirectory()}' is not registered. Cannot search for registered items within the given collection.`
            );
        }

        return collection.getStoredDataForPath(itemPath);
    }

    public getRegisteredCollectionForItem(itemPath: string) {
        return this.getRegisteredCollections().find((collection) =>
            itemPath.startsWith(
                normalizeDirectoryPath(collection.getRootDirectory())
            )
        );
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
        return (await getAllCollectionRootDirectories()).map(
            (rootDirectory) => {
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
            }
        );
    }
}
