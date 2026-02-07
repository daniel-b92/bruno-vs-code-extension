import { CollectionExplorer } from "./internal/collectionExplorer";
import { EventEmitter, ExtensionContext, Uri } from "vscode";
import {
    TypedCollectionItemProvider,
    getLoggerFromSubscriptions,
    MultiFileOperationWithStatus,
} from "../shared";

export function activateTreeView(
    context: ExtensionContext,
    itemProvider: TypedCollectionItemProvider,
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
