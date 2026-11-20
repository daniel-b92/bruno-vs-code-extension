import { FileChangeType, NotificationData, normalizePath } from "../..";

/**
 * Sorts the notifications by path. For notifications with the same path, the order is determined by the update type: A modification is handled before
 * a deletion and a deletion before a creation. So if a path was deleted and re-created within the same batch, the item still exists afterwards.
 */
export function compareNotificationsForBatch<T>(
    { data: { item: item1 }, updateType: type1 }: NotificationData<T>,
    { data: { item: item2 }, updateType: type2 }: NotificationData<T>,
) {
    const path1 = normalizePath(item1.getPath());
    const path2 = normalizePath(item2.getPath());

    if (path1 != path2) {
        return path1 < path2 ? -1 : 1;
    }

    return (
        getUpdateTypeOrderForSamePath(type1) -
        getUpdateTypeOrderForSamePath(type2)
    );
}

function getUpdateTypeOrderForSamePath(updateType: FileChangeType) {
    switch (updateType) {
        case FileChangeType.Modified:
            return 0;
        case FileChangeType.Deleted:
            return 1;
        case FileChangeType.Created:
            return 2;
    }
}
