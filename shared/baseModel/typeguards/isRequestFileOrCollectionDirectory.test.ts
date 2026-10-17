import { describe, it, expect } from "@jest/globals";
import {
    BrunoAppFile,
    BrunoEnvironmentFile,
    BrunoRequestFile,
    CollectionDirectory,
    isCollectionItemWithSequence,
} from "../..";
import { isRequestFileOrCollectionDirectory } from "./isRequestFileOrCollectionDirectory";

describe("isRequestFileOrCollectionDirectory", () => {
    it("returns true for request files", () => {
        expect(
            isRequestFileOrCollectionDirectory(
                new BrunoRequestFile("/collection/request.bru", 1),
            ),
        ).toBe(true);
    });

    it("returns true for collection directories", () => {
        expect(
            isRequestFileOrCollectionDirectory(
                new CollectionDirectory("/collection/folder", undefined, 1),
            ),
        ).toBe(true);
    });

    it("returns false for app files, even if they have a sequence", () => {
        const appFile = new BrunoAppFile("/collection/app.bru", 1);

        expect(isCollectionItemWithSequence(appFile)).toBe(true);
        expect(isRequestFileOrCollectionDirectory(appFile)).toBe(false);
    });

    it("returns false for environment files", () => {
        expect(
            isRequestFileOrCollectionDirectory(
                new BrunoEnvironmentFile(
                    "/collection/environments/dev.bru",
                    [],
                ),
            ),
        ).toBe(false);
    });
});
