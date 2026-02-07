import { CollectionExplorer } from "./internal/collectionExplorer";
import { EventEmitter, ExtensionContext, Uri } from "vscode";
import {
    TypedCollectionItemProvider,
    getLoggerFromSubscriptions,
    MultiFileOperationWithStatus,
    FileSystemCacheSyncingHelper,
} from "../shared";

export function activateTreeView(
    context: ExtensionContext,
    itemProvider: TypedCollectionItemProvider,
    cacheSyncingHelper: FileSystemCacheSyncingHelper,
    startTestRunEmitter: EventEmitter<{
        uri: Uri;
        withDialog: boolean;
    }>,
    multiFileOperationNotifier: EventEmitter<MultiFileOperationWithStatus>,
) {
    context.subscriptions.push(
        new CollectionExplorer(
            itemProvider,
            cacheSyncingHelper,
            startTestRunEmitter,
            multiFileOperationNotifier,
            getLoggerFromSubscriptions(context),
        ),
    );
}
