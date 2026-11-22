import { describe, it, expect } from "@jest/globals";
import {
    BrunoAppFile,
    BrunoEnvironmentFile,
    BrunoRequestFile,
    CollectionDirectory,
    CollectionFormat,
    CollectionItem,
    FileChangeType,
    NotificationData,
} from "@global_shared";
import { createCollectionWithEnvironments } from "@global_shared/_testingUtils";
import { shouldRefreshDiagnosticsAfterCacheUpdate } from "./shouldRefreshDiagnosticsAfterCacheUpdate";

describe("shouldRefreshDiagnosticsAfterCacheUpdate", () => {
    it.each([FileChangeType.Created, FileChangeType.Deleted] as const)(
        "returns true for a request file with a sequence and update type '%s'",
        (updateType) => {
            expect(
                shouldRefreshDiagnosticsAfterCacheUpdate([
                    createNotification(
                        updateType,
                        new BrunoRequestFile("/collection/request.yml", 1),
                    ),
                ]),
            ).toBe(true);
        },
    );

    it("returns true for the notifications of a renamed request file", () => {
        expect(
            shouldRefreshDiagnosticsAfterCacheUpdate([
                createNotification(
                    FileChangeType.Deleted,
                    new BrunoRequestFile("/collection/old.yml", 1),
                ),
                createNotification(
                    FileChangeType.Created,
                    new BrunoRequestFile("/collection/new.yml", 1),
                ),
            ]),
        ).toBe(true);
    });

    it.each([
        ["an app file", new BrunoAppFile("/collection/app.yml", 2)],
        [
            "a folder",
            new CollectionDirectory(
                "/collection/folder",
                "/collection/folder/folder.yml",
                3,
            ),
        ],
    ])("returns true for a created %s with a sequence", (_, item) => {
        expect(
            shouldRefreshDiagnosticsAfterCacheUpdate([
                createNotification(FileChangeType.Created, item),
            ]),
        ).toBe(true);
    });

    it.each([
        [
            "a request file without a sequence",
            new BrunoRequestFile("/collection/request.yml"),
        ],
        [
            "a folder without a sequence",
            new CollectionDirectory("/collection/folder"),
        ],
        [
            "an environment file",
            new BrunoEnvironmentFile("/collection/environments/dev.yml", []),
        ],
    ])("returns false for a deleted %s", (_, item) => {
        expect(
            shouldRefreshDiagnosticsAfterCacheUpdate([
                createNotification(FileChangeType.Deleted, item),
            ]),
        ).toBe(false);
    });

    it("returns true for a modification with a changed sequence", () => {
        expect(
            shouldRefreshDiagnosticsAfterCacheUpdate([
                createModification({
                    sequenceChanged: true,
                    tagsChanged: false,
                    additionalDataChanged: false,
                }),
            ]),
        ).toBe(true);
    });

    it.each([
        [
            "only other data changed",
            {
                sequenceChanged: false,
                tagsChanged: true,
                additionalDataChanged: true,
            },
        ],
        ["no data changed", undefined],
    ])(
        "returns false for a modification of an item with a sequence, if %s",
        (_, changedData) => {
            expect(
                shouldRefreshDiagnosticsAfterCacheUpdate([
                    createModification(changedData),
                ]),
            ).toBe(false);
        },
    );

    it("returns false for an empty batch", () => {
        expect(shouldRefreshDiagnosticsAfterCacheUpdate([])).toBe(false);
    });
});

type ChangedData = {
    sequenceChanged: boolean;
    tagsChanged: boolean;
    additionalDataChanged: boolean;
};

function createModification(
    changedData: ChangedData | undefined,
): NotificationData<undefined> {
    return {
        ...createNotificationBase(
            new BrunoRequestFile("/collection/request.yml", 1),
        ),
        updateType: FileChangeType.Modified,
        changedData,
    };
}

function createNotification(
    updateType: FileChangeType.Created | FileChangeType.Deleted,
    item: CollectionItem,
): NotificationData<undefined> {
    return { ...createNotificationBase(item), updateType };
}

function createNotificationBase(item: CollectionItem) {
    return {
        collection: createCollectionWithEnvironments([], CollectionFormat.Yaml),
        data: { item, additionalData: undefined },
    };
}
