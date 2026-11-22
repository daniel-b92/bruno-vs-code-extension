import { CollectionExplorer } from "./internal/collectionExplorer";
import { EventEmitter, ExtensionContext, Uri } from "vscode";
import {
    TypedCollectionItemProvider,
    getLoggerFromSubscriptions,
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
) {
    context.subscriptions.push(
        new CollectionExplorer(
            itemProvider,
            cacheSyncingHelper,
            startTestRunEmitter,
            getLoggerFromSubscriptions(context),
        ),
    );
}
