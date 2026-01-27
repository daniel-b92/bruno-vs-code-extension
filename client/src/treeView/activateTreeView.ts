import { CollectionExplorer } from "./internal/collectionExplorer";
import { EventEmitter, ExtensionContext, Uri } from "vscode";
import {
    CollectionItemProvider,
    getLoggerFromSubscriptions,
    MultiFileOperationWithStatus,
} from "../shared";

export function activateTreeView(
    context: ExtensionContext,
    itemProvider: CollectionItemProvider,
    startTestRunEmitter: EventEmitter<{
        uri: Uri;
        withDialog: boolean;
    }>,
    multiFileOperationNotifier: EventEmitter<MultiFileOperationWithStatus>,
) {
    context.subscriptions.push(
        new CollectionExplorer(
            itemProvider,
            startTestRunEmitter,
            multiFileOperationNotifier,
            getLoggerFromSubscriptions(context),
        ),
    );
}
