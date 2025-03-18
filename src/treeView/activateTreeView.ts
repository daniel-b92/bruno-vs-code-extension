import { CollectionExplorer } from "./collectionExplorer";
import { CollectionWatcher } from "../shared/fileSystem/collectionWatcher";
import { EventEmitter, Uri } from "vscode";

export function activateTreeView(
    collectionWatcher: CollectionWatcher,
    startTestRunEmitter: EventEmitter<Uri>
) {
    new CollectionExplorer(collectionWatcher, startTestRunEmitter);
}
