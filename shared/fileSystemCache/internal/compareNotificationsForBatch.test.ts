import { describe, it, expect } from "@jest/globals";
import {
    BrunoRequestFile,
    Collection,
    CollectionDirectory,
    CollectionFormat,
    FileChangeType,
    NotificationData,
} from "../..";
import { compareNotificationsForBatch } from "./compareNotificationsForBatch";

describe("compareNotificationsForBatch", () => {
    it("sorts notifications by path", () => {
        const sorted = [
            createNotification("/collection/b.bru", FileChangeType.Created),
            createNotification("/collection/a.bru", FileChangeType.Created),
            createNotification("/collection", FileChangeType.Created),
        ].sort(compareNotificationsForBatch);

        expect(getPathsAndTypes(sorted).map(({ path }) => path)).toEqual([
            "/collection",
            "/collection/a.bru",
            "/collection/b.bru",
        ]);
    });

    it.each([
        [FileChangeType.Deleted, FileChangeType.Created],
        [FileChangeType.Created, FileChangeType.Deleted],
    ])(
        "sorts the deletion before the creation for the same path regardless of the initial order (%s, %s)",
        (first, second) => {
            const sorted = [
                createNotification("/collection/a.bru", first),
                createNotification("/collection/a.bru", second),
            ].sort(compareNotificationsForBatch);

            expect(getPathsAndTypes(sorted).map(({ type }) => type)).toEqual([
                FileChangeType.Deleted,
                FileChangeType.Created,
            ]);
        },
    );

    it("sorts the modification before the deletion and the creation for the same path", () => {
        const sorted = [
            createNotification("/collection/a.bru", FileChangeType.Created),
            createNotification("/collection/a.bru", FileChangeType.Deleted),
            createNotification("/collection/a.bru", FileChangeType.Modified),
        ].sort(compareNotificationsForBatch);

        expect(getPathsAndTypes(sorted).map(({ type }) => type)).toEqual([
            FileChangeType.Modified,
            FileChangeType.Deleted,
            FileChangeType.Created,
        ]);
    });
});

function createNotification(
    path: string,
    updateType: FileChangeType,
): NotificationData<undefined> {
    return {
        collection: new Collection(
            new CollectionDirectory("/collection"),
            undefined,
            [],
            CollectionFormat.Bru,
        ),
        data: {
            item: path.endsWith(".bru")
                ? new BrunoRequestFile(path, 1)
                : new CollectionDirectory(path),
            additionalData: undefined,
        },
        updateType,
    };
}

function getPathsAndTypes(notifications: NotificationData<undefined>[]) {
    return notifications.map(({ data, updateType }) => ({
        path: data.item.getPath(),
        type: updateType,
    }));
}
