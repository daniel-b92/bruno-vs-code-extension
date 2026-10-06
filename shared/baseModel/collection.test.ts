import { describe, it, expect } from "@jest/globals";
import { createCollectionWithEnvironments } from "../_testingUtils";
import { CollectionFormat } from "./interfaces";

describe("Collection.getEnvironmentInheritanceChain", () => {
    it("returns an empty chain when the environment does not extend anything", () => {
        const collection = createCollectionWithEnvironments([{ name: "Base" }]);

        expect(collection.getEnvironmentInheritanceChain("Base")).toEqual([]);
    });

    it("returns the ordered chain of ancestors, nearest parent first", () => {
        const collection = createCollectionWithEnvironments([
            { name: "Base" },
            { name: "Staging", extends: "Base" },
            { name: "Dev", extends: "Staging" },
        ]);

        expect(collection.getEnvironmentInheritanceChain("Dev")).toEqual([
            "Staging",
            "Base",
        ]);
    });

    it("stops instead of looping when the chain contains a cycle", () => {
        const collection = createCollectionWithEnvironments([
            { name: "A", extends: "B" },
            { name: "B", extends: "A" },
        ]);

        expect(collection.getEnvironmentInheritanceChain("A")).toEqual(["B"]);
    });

    it("stops when the referenced environment does not exist", () => {
        const collection = createCollectionWithEnvironments([
            { name: "Dev", extends: "Unknown" },
        ]);

        expect(collection.getEnvironmentInheritanceChain("Dev")).toEqual([
            "Unknown",
        ]);
    });
});

describe("Collection.getEnvironmentsExtending", () => {
    it("returns the environments directly extending the given one", () => {
        const collection = createCollectionWithEnvironments([
            { name: "Base" },
            { name: "Staging", extends: "Base" },
            { name: "Dev", extends: "Base" },
            { name: "Other" },
        ]);

        expect(collection.getEnvironmentsExtending("Base").sort()).toEqual([
            "Dev",
            "Staging",
        ]);
    });

    it("returns an empty array when no environment extends it", () => {
        const collection = createCollectionWithEnvironments([{ name: "Base" }]);

        expect(collection.getEnvironmentsExtending("Base")).toEqual([]);
    });
});

describe("Collection.getEnvironments", () => {
    it("strips the file extension matching the collection format from the environment names", () => {
        const bruCollection = createCollectionWithEnvironments([
            { name: "Dev" },
        ]);
        const yamlCollection = createCollectionWithEnvironments(
            [{ name: "Dev" }],
            "/collection",
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
