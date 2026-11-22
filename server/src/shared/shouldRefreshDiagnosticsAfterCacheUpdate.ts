import {
    FileChangeType,
    isCollectionItemWithSequence,
    NotificationData,
} from "@global_shared";

/**
 * Whether the diagnostics of the open documents need to be refreshed after the given batch of cache updates.
 * This is needed for keeping the diagnostics for duplicate sequences in sync, since they depend on other items in the cache.
 *
 * Besides changed sequences, this includes created or deleted items with a sequence (e.g. when renaming or moving a request).
 * The cache is only updated after a delay, so the diagnostics for a renamed file may already have been determined
 * while the item with the old path was still registered.
 */
export function shouldRefreshDiagnosticsAfterCacheUpdate<T>(
    changes: NotificationData<T>[],
) {
    return changes.some((change) =>
        change.updateType == FileChangeType.Modified
            ? change.changedData?.sequenceChanged
            : isCollectionItemWithSequence(change.data.item) &&
              change.data.item.getSequence() !== undefined,
    );
}
