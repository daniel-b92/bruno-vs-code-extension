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
});

function createData(tags: string[] | undefined): CollectionData<undefined> {
    return {
        item: new CollectionDirectory(
            "/collection/folder",
            "/collection/folder/folder.bru",
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
