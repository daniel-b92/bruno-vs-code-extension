import { CollectionExplorer } from "./collectionExplorer";
import { CollectionWatcher } from "../shared/fileSystem/collectionWatcher";
import { EventEmitter, Uri } from "vscode";
import { CollectionItemProvider } from "../shared/state/collectionItemProvider";

export function activateTreeView(
    collectionWatcher: CollectionWatcher,
    itemProvider: CollectionItemProvider,
    startTestRunEmitter: EventEmitter<Uri>
) {
    new CollectionExplorer(
        collectionWatcher,
        itemProvider,
        startTestRunEmitter
    );
}
