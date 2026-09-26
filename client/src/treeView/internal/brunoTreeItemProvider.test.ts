import { describe, it, expect, beforeEach } from "@jest/globals";
import { BrunoTreeItem } from "@shared";
import { BrunoTreeItemProvider } from "./brunoTreeItemProvider";

const mockItemProvider = { subscribeToUpdates: () => {} } as any;

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

function getSortedItems(
    provider: BrunoTreeItemProvider,
    items: BrunoTreeItem[],
): BrunoTreeItem[] {
    return (
        provider as unknown as {
            getSortedTreeItems(items: BrunoTreeItem[]): BrunoTreeItem[];
        }
    ).getSortedTreeItems(items);
}

describe("BrunoTreeItemProvider - getSortedTreeItems1", () => {
    let provider: BrunoTreeItemProvider;

    beforeEach(() => {
        provider = new BrunoTreeItemProvider("/workspace", mockItemProvider);
    });

    describe("folders vs files ordering", () => {
        it("places folders before files", () => {
            const items = [
                makeItem(true, "b-file.bru"),
                makeItem(false, "a-folder"),
            ];
            const result = getSortedItems(provider, items);
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
            const result = getSortedItems(provider, items);
            expect(result[0].isFile).toBe(false);
            expect(result[1].isFile).toBe(false);
            expect(result[2].isFile).toBe(true);
            expect(result[3].isFile).toBe(true);
        });
    });

    describe("alphabetical ordering (no sequences)", () => {
        it("sorts items without a sequence alphabetically by label", () => {
            const items = [
                makeItem(false, "zeta"),
                makeItem(false, "alpha"),
                makeItem(false, "mu"),
            ];
            const result = getSortedItems(provider, items);
            expect(result.map((i) => i.label)).toEqual(["alpha", "mu", "zeta"]);
        });

        it("sorts alphabetically case-insensitively", () => {
            const items = [
                makeItem(false, "Beta"),
                makeItem(false, "alpha"),
                makeItem(false, "GAMMA"),
            ];
            const result = getSortedItems(provider, items);
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
            const result = getSortedItems(provider, items);
            expect(result.map((i) => i.getSequence())).toEqual([1, 2, 3]);
        });

        it("places items with a sequence before items without one", () => {
            const items = [
                makeItem(false, "no-seq-folder"),
                makeItem(false, "sequenced-folder", 1),
            ];
            const result = getSortedItems(provider, items);
            expect(result[0].getSequence()).toBe(1);
            expect(result[1].getSequence()).toBeUndefined();
        });
    });

    describe("does not mutate the input array", () => {
        it("returns a new array without modifying the original", () => {
            const items = [makeItem(true, "z.bru"), makeItem(true, "a.bru")];
            const original = [...items];
            getSortedItems(provider, items);
            expect(items[0].label).toBe(original[0].label);
            expect(items[1].label).toBe(original[1].label);
        });
    });
});
