import { CollectionExplorer } from "./collectionExplorer";
import { EventEmitter, Uri } from "vscode";
import { CollectionItemProvider } from "../shared/state/externalHelpers/collectionItemProvider";

export function activateTreeView(
    itemProvider: CollectionItemProvider,
    startTestRunEmitter: EventEmitter<Uri>
) {
    new CollectionExplorer(itemProvider, startTestRunEmitter);
}
