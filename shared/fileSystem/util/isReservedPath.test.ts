import { describe, it, expect } from "@jest/globals";
import { CollectionFormat } from "../../baseModel/interfaces";
import { createCollectionWithEnvironments } from "../../_testingUtils";
import { isReservedPath } from "./isReservedPath";

describe("isReservedPath", () => {
    it.each([
        [CollectionFormat.Bru, "collection.bru", true, true],
        [CollectionFormat.Bru, "sub/collection.bru", true, false],
        [CollectionFormat.Bru, "sub/folder.bru", true, true],
        [CollectionFormat.Bru, "folder.bru", true, false],
        [CollectionFormat.Bru, "sub/folder.yml", true, false],
        [CollectionFormat.Bru, "environments", false, true],
        [CollectionFormat.Bru, "sub/environments", false, false],
        [CollectionFormat.Bru, "folder.bru", false, false],
        [CollectionFormat.Yaml, "opencollection.yml", true, true],
        [CollectionFormat.Yaml, "sub/opencollection.yml", true, false],
        [CollectionFormat.Yaml, "sub/folder.yml", true, true],
        [CollectionFormat.Yaml, "folder.yml", true, false],
        [CollectionFormat.Yaml, "sub/folder.bru", true, false],
        [CollectionFormat.Yaml, "environments", false, true],
        [CollectionFormat.Yaml, "sub/environments", false, false],
    ])(
        "in a %s collection for '%s' (is file: %s) returns %s",
        (format, relativePath, isFile, expected) => {
            const collection = createCollectionWithEnvironments([], format);

            expect(
                isReservedPath(
                    collection,
                    `${collection.getRootDirectory()}/${relativePath}`,
                    isFile,
                ),
            ).toBe(expected);
        },
    );
});
