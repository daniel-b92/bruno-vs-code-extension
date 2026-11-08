import { describe, it, expect } from "@jest/globals";
import { createCollectionWithEnvironments } from "../_testingUtils";
import { Collection } from "./collection";
import { CollectionDirectory } from "./collectionDirectory";
import { CollectionFormat } from "./interfaces";

describe("Collection.getEnvironmentInheritanceChain", () => {
    it("returns an empty chain when the environment does not extend anything", () => {
        const collection = createCollectionWithEnvironments(
            [{ name: "Base" }],
            CollectionFormat.Bru,
        );

        expect(collection.getEnvironmentInheritanceChain("Base")).toEqual([]);
    });

    it("returns the ordered chain of ancestors, nearest parent first", () => {
        const collection = createCollectionWithEnvironments(
            [
                { name: "Base" },
                { name: "Staging", extends: "Base" },
                { name: "Dev", extends: "Staging" },
            ],
            CollectionFormat.Bru,
        );

        expect(collection.getEnvironmentInheritanceChain("Dev")).toEqual([
            "Staging",
            "Base",
        ]);
    });

    it("stops instead of looping when the chain contains a cycle", () => {
        const collection = createCollectionWithEnvironments(
            [
                { name: "A", extends: "B" },
                { name: "B", extends: "A" },
            ],
            CollectionFormat.Bru,
        );

        expect(collection.getEnvironmentInheritanceChain("A")).toEqual(["B"]);
    });

    it("stops when the referenced environment does not exist", () => {
        const collection = createCollectionWithEnvironments(
            [{ name: "Dev", extends: "Unknown" }],
            CollectionFormat.Bru,
        );

        expect(collection.getEnvironmentInheritanceChain("Dev")).toEqual([
            "Unknown",
        ]);
    });
});

describe("Collection.getEnvironmentsExtending", () => {
    it("returns the environments directly extending the given one", () => {
        const collection = createCollectionWithEnvironments(
            [
                { name: "Base" },
                { name: "Staging", extends: "Base" },
                { name: "Dev", extends: "Base" },
                { name: "Other" },
            ],
            CollectionFormat.Bru,
        );

        expect(collection.getEnvironmentsExtending("Base").sort()).toEqual([
            "Dev",
            "Staging",
        ]);
    });

    it("returns an empty array when no environment extends it", () => {
        const collection = createCollectionWithEnvironments(
            [{ name: "Base" }],
            CollectionFormat.Bru,
        );

        expect(collection.getEnvironmentsExtending("Base")).toEqual([]);
    });
});

describe("Collection.getEnvironments", () => {
    it("strips the file extension matching the collection format from the environment names", () => {
        const bruCollection = createCollectionWithEnvironments(
            [{ name: "Dev" }],
            CollectionFormat.Bru,
        );
        const yamlCollection = createCollectionWithEnvironments(
            [{ name: "Dev" }],
            CollectionFormat.Yaml,
        );

        expect(
            bruCollection.getEnvironments().map((e) => e.environmentName),
        ).toEqual(["Dev"]);
        expect(
            yamlCollection.getEnvironments().map((e) => e.environmentName),
        ).toEqual(["Dev"]);
    });
});

describe("Collection.removeTestItemAndDescendants", () => {
    it("removes the descendants of a directory when the drive letter in the stored paths is lower case (Windows)", () => {
        const folder = new CollectionDirectory("c:\\coll\\folder");
        const collection = createCollectionWithDirectories("c:\\coll", [
            folder,
            new CollectionDirectory("c:\\coll\\folder\\sub"),
            new CollectionDirectory("c:\\coll\\other"),
        ]);

        collection.removeTestItemAndDescendants(folder);

        expect(getStoredPaths(collection)).toEqual([
            "c:\\coll",
            "c:\\coll\\other",
        ]);
    });

    it("does not remove sibling directories that share the name prefix of the removed one", () => {
        const folder = new CollectionDirectory("/coll/foo");
        const collection = createCollectionWithDirectories("/coll", [
            folder,
            new CollectionDirectory("/coll/foo/sub"),
            new CollectionDirectory("/coll/foobar"),
        ]);

        collection.removeTestItemAndDescendants(folder);

        expect(getStoredPaths(collection)).toEqual(["/coll", "/coll/foobar"]);
    });
});

function createCollectionWithDirectories(
    rootDirectory: string,
    directories: CollectionDirectory[],
) {
    const collection = new Collection(
        new CollectionDirectory(rootDirectory),
        undefined,
        [],
        CollectionFormat.Bru,
    );
    directories.forEach((item) =>
        collection.addItem({ item, additionalData: undefined }),
    );

    return collection;
}

function getStoredPaths(collection: Collection<undefined>) {
    return collection
        .getAllStoredDataForCollection()
        .map(({ item }) => item.getPath());
}
