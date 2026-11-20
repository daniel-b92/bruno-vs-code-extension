import { describe, it, expect } from "@jest/globals";
import {
    BrunoRequestFile,
    CollectionDirectory,
    CollectionFormat,
    CollectionItemProvider,
} from "../..";
import { createCollectionWithItems } from "../../_testingUtils";
import { getExistingTags } from "./getExistingTags";

describe("getExistingTags", () => {
    it("includes tags of folder settings files", () => {
        const { collection, itemProvider } = createProvider();

        const result = getExistingTags(itemProvider, {
            collection,
            pathToIgnore: "/collection/other.bru",
        });

        expect(result).toEqual([
            {
                tag: "folderTag",
                pathsInOwnCollection: ["/collection/folder/folder.bru"],
                inOtherCollections: [],
            },
            {
                tag: "requestTag",
                pathsInOwnCollection: ["/collection/folder/request.bru"],
                inOtherCollections: [],
            },
        ]);
    });

    it("ignores the settings file of a directory", () => {
        const { collection, itemProvider } = createProvider();

        const result = getExistingTags(itemProvider, {
            collection,
            pathToIgnore: "/collection/folder/folder.bru",
        });

        expect(result.map(({ tag }) => tag)).toEqual(["requestTag"]);
    });

    it("ignores directories without a settings file", () => {
        const { collection, itemProvider } = createCollectionWithItems<
            CollectionItemProvider<undefined>
        >(
            [
                new CollectionDirectory("/collection/folder", undefined, 1, [
                    "tag",
                ]),
            ],
            CollectionFormat.Bru,
        );

        expect(
            getExistingTags(itemProvider, {
                collection,
                pathToIgnore: "/collection/other.bru",
            }),
        ).toEqual([]);
    });
});

function createProvider() {
    return createCollectionWithItems<CollectionItemProvider<undefined>>(
        [
            new CollectionDirectory(
                "/collection/folder",
                "/collection/folder/folder.bru",
                1,
                ["folderTag"],
            ),
            new BrunoRequestFile("/collection/folder/request.bru", 1, [
                "requestTag",
            ]),
        ],
        CollectionFormat.Bru,
    );
}
