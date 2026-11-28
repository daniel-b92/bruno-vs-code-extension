import { describe, it, expect } from "@jest/globals";
import { BrunoTreeItem } from "@shared";
import { sortTreeItems } from "./sortTreeItems";

describe("sortTreeItems", () => {
    describe("folders vs files ordering", () => {
        it("places folders before files", () => {
            const items = [
                makeItem(true, "b-file.bru"),
                makeItem(false, "a-folder"),
            ];
            const result = sortTreeItems(items);
            expect(result[0].isFile).toBe(false);
            expect(result[1].isFile).toBe(true);
        });

        it("keeps relative order among multiple folders and files", () => {
            const items = [
                makeItem(true, "file1.bru"),
                makeItem(false, "folder2"),
                makeItem(true, "file2.bru"),
                makeItem(false, "folder1"),
            ];
            const result = sortTreeItems(items);
            expect(result[0].isFile).toBe(false);
            expect(result[1].isFile).toBe(false);
            expect(result[2].isFile).toBe(true);
            expect(result[3].isFile).toBe(true);
        });

        it("places folder before file even when the file has a lower sequence", () => {
            const items = [
                makeItem(true, "file.bru", 1),
                makeItem(false, "folder", 2),
            ];
            const result = sortTreeItems(items);
            expect(result[0].isFile).toBe(false);
            expect(result[1].isFile).toBe(true);
        });

        it("places folder before file even when the file has no sequence and the folder does", () => {
            const items = [
                makeItem(true, "a-file.bru"),
                makeItem(false, "z-folder", 1),
            ];
            const result = sortTreeItems(items);
            expect(result[0].isFile).toBe(false);
            expect(result[1].isFile).toBe(true);
        });

        it("places folder before file even when the folder has no sequence and the file does", () => {
            const items = [
                makeItem(true, "a-file.bru", 1),
                makeItem(false, "z-folder"),
            ];
            const result = sortTreeItems(items);
            expect(result[0].isFile).toBe(false);
            expect(result[1].isFile).toBe(true);
        });

        it("places folder before file even when alphabetical order would put the file first", () => {
            const items = [
                makeItem(true, "alpha.bru"),
                makeItem(false, "zeta"),
            ];
            const result = sortTreeItems(items);
            expect(result[0].isFile).toBe(false);
            expect(result[1].isFile).toBe(true);
        });
    });

    describe("alphabetical ordering (no sequences)", () => {
        it("sorts items without a sequence alphabetically by label", () => {
            const items = [
                makeItem(false, "zeta"),
                makeItem(false, "alpha"),
                makeItem(false, "mu"),
            ];
            const result = sortTreeItems(items);
            expect(result.map((i) => i.label)).toEqual(["alpha", "mu", "zeta"]);
        });

        it("sorts alphabetically case-insensitively", () => {
            const items = [
                makeItem(false, "Beta"),
                makeItem(false, "alpha"),
                makeItem(false, "GAMMA"),
            ];
            const result = sortTreeItems(items);
            expect(result.map((i) => i.label)).toEqual([
                "alpha",
                "Beta",
                "GAMMA",
            ]);
        });
    });

    describe("sequence ordering", () => {
        it("sorts items with a sequence numerically", () => {
            const items = [
                makeItem(false, "third", 3),
                makeItem(false, "first", 1),
                makeItem(false, "second", 2),
            ];
            const result = sortTreeItems(items);
            expect(result.map((i) => i.getSequence())).toEqual([1, 2, 3]);
        });

        it("places items with a sequence before items without one", () => {
            const items = [
                makeItem(false, "no-seq-folder"),
                makeItem(false, "sequenced-folder", 1),
            ];
            const result = sortTreeItems(items);
            expect(result[0].getSequence()).toBe(1);
            expect(result[1].getSequence()).toBeUndefined();
        });
    });

    describe("sequence 0", () => {
        it("is ordered like any other sequence", () => {
            const items = [
                makeItem(false, "no-seq-folder"),
                makeItem(false, "first", 1),
                makeItem(false, "zeroth", 0),
            ];
            const result = sortTreeItems(items);
            expect(result.map((i) => i.label)).toEqual([
                "zeroth",
                "first",
                "no-seq-folder",
            ]);
        });
    });

    describe("does not mutate the input array", () => {
        it("returns a new array without modifying the original", () => {
            const items = [makeItem(true, "z.bru"), makeItem(true, "a.bru")];
            const original = [...items];
            sortTreeItems(items);
            expect(items[0].label).toBe(original[0].label);
            expect(items[1].label).toBe(original[1].label);
        });
    });
});

function makeItem(
    isFile: boolean,
    label: string,
    sequence?: number,
): BrunoTreeItem {
    return {
        isFile,
        label,
        getSequence: () => sequence,
    } as unknown as BrunoTreeItem;
}
