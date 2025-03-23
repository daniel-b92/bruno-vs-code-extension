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
import { CollectionItem } from "./model/collectionItemInterface";

export class CollectionItemProvider {
    constructor(collectionWatcher: CollectionWatcher) {
        this.collectionRegistry = new CollectionRegistry(collectionWatcher);
        this.itemUpdateEmitter = new vscode.EventEmitter<{
            collection: Collection;
            item: CollectionItem;
            updateType: "Created" | "Deleted";
        }>();

        collectionWatcher.subscribeToUpdates()(
            ({ uri, changeType: fileChangeType }) => {
                const registeredCollection = this.collectionRegistry
                    .getRegisteredCollections()
                    .find((collection) =>
                        uri.fsPath.startsWith(
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
                            item: registeredCollection.getTestItemForPath(
                                registeredCollection.getRootDirectory()
                            ) as CollectionItem,
                            updateType: "Deleted",
                        });
                    }
                    return;
                }

                const maybeRegisteredItem =
                    registeredCollection.getTestItemForPath(uri.fsPath);

                if (
                    !maybeRegisteredItem &&
                    fileChangeType == FileChangeType.Created
                ) {
                    const item = lstatSync(uri.fsPath).isDirectory()
                        ? new CollectionDirectory(uri.fsPath)
                        : new CollectionFile(
                              uri.fsPath,
                              getSequence(uri.fsPath)
                          );

                    registeredCollection.addTestItem(item);

                    this.itemUpdateEmitter.fire({
                        collection: registeredCollection,
                        item,
                        updateType: "Created",
                    });
                }

                if (
                    maybeRegisteredItem &&
                    (FileChangeType.Deleted ||
                        (fileChangeType == FileChangeType.Modified &&
                            maybeRegisteredItem instanceof CollectionFile &&
                            maybeRegisteredItem.getSequence() !=
                                getSequence(uri.fsPath)))
                ) {
                    registeredCollection.removeTestItemAndDescendants(
                        maybeRegisteredItem
                    );
                    this.itemUpdateEmitter.fire({
                        collection: registeredCollection,
                        item: maybeRegisteredItem,
                        updateType: "Deleted",
                    });
                }
            }
        );
    }

    private collectionRegistry: CollectionRegistry;
    private itemUpdateEmitter: vscode.EventEmitter<{
        collection: Collection;
        item: CollectionItem;
        updateType: "Created" | "Deleted";
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

        return collection.getTestItemForPath(itemPath);
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
