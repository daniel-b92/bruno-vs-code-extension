import { describe, it, expect } from "@jest/globals";
import {
    AdditionalCollectionDataProviderType,
    CollectionData,
    CollectionDirectory,
} from "../..";
import { isModifiedItemOutdated } from "./isModifiedItemOutdated";

describe("isModifiedItemOutdated", () => {
    it("reports changed tags of directories", () => {
        const { isOutdated, details } = isModifiedItemOutdated(
            createData(["a"]),
            createData(["a", "b"]),
            additionalDataProvider,
        );

        expect(isOutdated).toBe(true);
        expect(details.tagsOutdated).toBe(true);
        expect(details.sequenceOutdated).toBe(false);
    });

    it("reports added tags of directories", () => {
        expect(
            isModifiedItemOutdated(
                createData(undefined),
                createData(["a"]),
                additionalDataProvider,
            ).details.tagsOutdated,
        ).toBe(true);
    });

    it("does not report unchanged tags of directories", () => {
        expect(
            isModifiedItemOutdated(
                createData(["a", "b"]),
                createData(["b", "a"]),
                additionalDataProvider,
            ).isOutdated,
        ).toBe(false);
    });

    it.each([
        ["added", undefined, "/collection/folder/folder.bru"],
        ["deleted", "/collection/folder/folder.bru", undefined],
        [
            "changed",
            "/collection/folder/folder.bru",
            "/collection/folder/folder.yml",
        ],
    ])(
        "reports outdated additional data of directories if the settings file was %s",
        (_, oldSettingsFilePath, newSettingsFilePath) => {
            const { isOutdated, details } = isModifiedItemOutdated(
                createDataWithSettingsFile(undefined, oldSettingsFilePath),
                createDataWithSettingsFile(undefined, newSettingsFilePath),
                additionalDataProvider,
            );

            expect(isOutdated).toBe(true);
            expect(details.additionalDataOutdated).toBe(true);
            expect(details.sequenceOutdated).toBe(false);
            expect(details.tagsOutdated).toBe(false);
        },
    );
});

function createData(tags: string[] | undefined) {
    return createDataWithSettingsFile(tags, "/collection/folder/folder.bru");
}

function createDataWithSettingsFile(
    tags: string[] | undefined,
    settingsFilePath: string | undefined,
): CollectionData<undefined> {
    return {
        item: new CollectionDirectory(
            "/collection/folder",
            settingsFilePath,
            1,
            tags,
        ),
        additionalData: undefined,
    };
}

const additionalDataProvider = {
    paramType: AdditionalCollectionDataProviderType.SimpleCollectionItem,
    callback: () => undefined,
    isAdditionalDataOutdated: () => false,
} as const;
