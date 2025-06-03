import { CollectionExplorer } from "./internal/collectionExplorer";
import { EventEmitter, ExtensionContext, Uri } from "vscode";
import { CollectionItemProvider } from "../shared";

export function activateTreeView(
    context: ExtensionContext,
    itemProvider: CollectionItemProvider,
    startTestRunEmitter: EventEmitter<Uri>
) {
    context.subscriptions.push(
        new CollectionExplorer(itemProvider, startTestRunEmitter)
    );
}
