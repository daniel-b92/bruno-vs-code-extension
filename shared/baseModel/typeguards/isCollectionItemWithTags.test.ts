import { describe, it, expect } from "@jest/globals";
import {
    BrunoAppFile,
    BrunoEnvironmentFile,
    BrunoRequestFile,
    CollectionDirectory,
} from "../..";
import { isCollectionItemWithTags } from "./isCollectionItemWithTags";

describe("isCollectionItemWithTags", () => {
    it("returns true for request files", () => {
        expect(
            isCollectionItemWithTags(
                new BrunoRequestFile("/collection/request.bru", 1, ["a"]),
            ),
        ).toBe(true);
    });

    it("returns true for collection directories", () => {
        expect(
            isCollectionItemWithTags(
                new CollectionDirectory("/collection/folder", undefined, 1, [
                    "a",
                ]),
            ),
        ).toBe(true);
    });

    it("returns false for app files", () => {
        expect(
            isCollectionItemWithTags(
                new BrunoAppFile("/collection/app.bru", 1),
            ),
        ).toBe(false);
    });

    it("returns false for environment files", () => {
        expect(
            isCollectionItemWithTags(
                new BrunoEnvironmentFile(
                    "/collection/environments/dev.bru",
                    [],
                ),
            ),
        ).toBe(false);
    });
});
