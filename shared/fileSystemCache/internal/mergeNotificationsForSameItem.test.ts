import { describe, it, expect } from "@jest/globals";
import {
    CollectionDirectory,
    CollectionFormat,
    FileChangeType,
    NotificationData,
} from "../..";
import { createCollectionWithEnvironments } from "../../_testingUtils";
import { mergeNotificationsForSameItem } from "./mergeNotificationsForSameItem";

describe("mergeNotificationsForSameItem", () => {
    it("keeps the data of the newer notification", () => {
        const older = createNotification(FileChangeType.Created, "old");
        const newer = createNotification(FileChangeType.Created, "new");

        expect(mergeNotificationsForSameItem(older, newer)).toBe(newer);
    });

    it("keeps the properties that were reported as changed by either of the modifications", () => {
        const older = createModification({
            sequenceChanged: true,
            tagsChanged: false,
            additionalDataChanged: false,
        });
        const newer = createModification({
            sequenceChanged: false,
            tagsChanged: true,
            additionalDataChanged: false,
        });

        const merged = mergeNotificationsForSameItem(older, newer);

        expect(merged.data).toBe(newer.data);
        expect(getChangedData(merged)).toEqual({
            sequenceChanged: true,
            tagsChanged: true,
            additionalDataChanged: false,
        });
    });

    it("keeps the reported changes if the newer modification does not report any", () => {
        const changedData = {
            sequenceChanged: true,
            tagsChanged: false,
            additionalDataChanged: true,
        };

        const merged = mergeNotificationsForSameItem(
            createModification(changedData),
            createModification(undefined),
        );

        expect(getChangedData(merged)).toEqual(changedData);
    });

    it("keeps the changes reported by the newer modification if the older one does not report any", () => {
        const changedData = {
            sequenceChanged: false,
            tagsChanged: true,
            additionalDataChanged: false,
        };

        const merged = mergeNotificationsForSameItem(
            createModification(undefined),
            createModification(changedData),
        );

        expect(getChangedData(merged)).toEqual(changedData);
    });

    it("reports no changes if neither of the modifications does", () => {
        const merged = mergeNotificationsForSameItem(
            createModification(undefined),
            createModification(undefined),
        );

        expect(getChangedData(merged)).toBeUndefined();
    });
});

type ChangedData = {
    sequenceChanged: boolean;
    tagsChanged: boolean;
    additionalDataChanged: boolean;
};

function createModification(changedData: ChangedData | undefined) {
    return createNotification(FileChangeType.Modified, "folder", changedData);
}

function createNotification(
    updateType: FileChangeType,
    name: string,
    changedData?: ChangedData,
): NotificationData<undefined> {
    const base = {
        collection: createCollectionWithEnvironments([], CollectionFormat.Bru),
        data: {
            item: new CollectionDirectory(`/collection/${name}`),
            additionalData: undefined,
        },
    };

    return updateType == FileChangeType.Modified
        ? { ...base, updateType, changedData }
        : { ...base, updateType };
}

function getChangedData(notification: NotificationData<undefined>) {
    return notification.updateType == FileChangeType.Modified
        ? notification.changedData
        : undefined;
}
