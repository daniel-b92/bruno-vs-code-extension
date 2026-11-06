import { describe, it, expect } from "@jest/globals";
import { CollectionFormat } from "../../baseModel/interfaces";
import { createCollectionWithEnvironments } from "../../_testingUtils";
import { isInEnvironmentsFolderOfCollection } from "./isInFolderForEnvironmentFiles";

describe("isInEnvironmentsFolderOfCollection", () => {
    it.each([
        ["/collection/environments/Dev.yml", "/collection", true],
        ["/collection/environments/Dev.bru", "/collection", true],
        ["/collection/environments/nested/Dev.yml", "/collection", false],
        ["/collection/sub/environments/Dev.yml", "/collection", false],
        ["/collection/Dev.yml", "/collection", false],
        // A collection that is itself located in a folder named 'environments'.
        ["/environments/opencollection.yml", "/environments", false],
        ["/environments/request.yml", "/environments", false],
        ["/environments/environments/Dev.yml", "/environments", true],
    ])(
        "for '%s' in a collection with root '%s' returns %s",
        (path, rootDirectory, expected) => {
            const collection = createCollectionWithEnvironments(
                [],
                CollectionFormat.Yaml,
                rootDirectory,
            );

            expect(isInEnvironmentsFolderOfCollection(collection, path)).toBe(
                expected,
            );
        },
    );
});
