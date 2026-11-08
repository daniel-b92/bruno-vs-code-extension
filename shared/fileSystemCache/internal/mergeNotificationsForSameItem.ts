import { FileChangeType, NotificationData } from "../..";

/**
 * Merges two notifications of the same type for the same path, that are both waiting to be sent in the same batch.
 *
 * The newer notification carries the data that is currently registered in the cache. So its data is kept.
 * For modifications, a property that was reported as changed by either of the notifications stays reported as changed.
 * Otherwise, subscribers could miss that e.g. the sequence of a folder has changed, if a later notification did not detect the change anymore.
 */
export function mergeNotificationsForSameItem<T>(
    older: NotificationData<T>,
    newer: NotificationData<T>,
): NotificationData<T> {
    if (
        older.updateType != FileChangeType.Modified ||
        newer.updateType != FileChangeType.Modified
    ) {
        return newer;
    }

    if (!older.changedData || !newer.changedData) {
        return {
            ...newer,
            changedData: newer.changedData ?? older.changedData,
        };
    }

    return {
        ...newer,
        changedData: {
            sequenceChanged:
                older.changedData.sequenceChanged ||
                newer.changedData.sequenceChanged,
            tagsChanged:
                older.changedData.tagsChanged || newer.changedData.tagsChanged,
            additionalDataChanged:
                older.changedData.additionalDataChanged ||
                newer.changedData.additionalDataChanged,
        },
    };
}
