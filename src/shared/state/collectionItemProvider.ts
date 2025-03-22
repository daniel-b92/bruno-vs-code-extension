import { lstatSync } from "fs";
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
}
