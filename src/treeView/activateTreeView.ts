import { CollectionExplorer } from "./collectionExplorer";
import { CollectionWatcher } from "../shared/fileSystem/collectionWatcher";

export function activateTreeView(collectionWatcher: CollectionWatcher) {
    new CollectionExplorer(collectionWatcher);
}
