import { describe, it, expect } from "@jest/globals";
import { BrunoFileType, NonBrunoFile, NonBrunoSpecificItemType } from "../..";
import { getCollectionItemForFile } from "./getCollectionItem";

describe("getCollectionItemForFile", () => {
    it("returns a NonBrunoFile for OtherFileType", async () => {
        const result = await getCollectionItemForFile(
            "/some/path/script.js",
            NonBrunoSpecificItemType.OtherFileType,
        );

        expect(result).toBeInstanceOf(NonBrunoFile);
        expect(result?.getPath()).toBe("/some/path/script.js");
        expect(result?.getItemType()).toBe(
            NonBrunoSpecificItemType.OtherFileType,
        );
    });

    it("returns undefined for an unknown item type", async () => {
        const result = await getCollectionItemForFile(
            "/some/path/unknown",
            "unknown" as BrunoFileType,
        );

        expect(result).toBeUndefined();
    });
});
