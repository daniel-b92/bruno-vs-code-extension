import { CollectionExplorer } from "./internal/collectionExplorer";
import { initializeSequenceGapsHint } from "./internal/explorer/sequenceUtils/sequenceGapsHint";
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
    initializeSequenceGapsHint(context);
    context.subscriptions.push(
        new CollectionExplorer(
            itemProvider,
            cacheSyncingHelper,
            startTestRunEmitter,
            getLoggerFromSubscriptions(context),
        ),
    );
}
