import { describe, it, expect } from "@jest/globals";
import {
    calculateSequenceChangesForInsertion,
    SequencedItem,
    SequenceInsertionPointType,
} from "./calculateSequenceChangesForInsertion";

describe("calculateSequenceChangesForInsertion", () => {
    describe("appending", () => {
        it("uses the step for an empty folder", () => {
            expect(append([], 1)).toEqual({ newSequence: 1, shiftedItems: [] });
            expect(append([], 10)).toEqual({
                newSequence: 10,
                shiftedItems: [],
            });
        });

        it("uses the highest sequence plus the step, even if there are gaps", () => {
            expect(append(items(["a", 1], ["b", 7], ["c", 3]), 1)).toEqual({
                newSequence: 8,
                shiftedItems: [],
            });
            expect(append(items(["a", 10], ["b", 30]), 10)).toEqual({
                newSequence: 40,
                shiftedItems: [],
            });
        });
    });

    describe("inserting after an item", () => {
        it("uses the middle between the item and the following one, without changing other items", () => {
            expect(
                after(items(["get", 10], ["create", 20], ["delete", 30]), 10),
            ).toEqual({ newSequence: 15, shiftedItems: [] });
        });

        it("rounds down if there is no exact middle", () => {
            expect(after(items(["a", 10], ["b", 13]), 10)).toEqual({
                newSequence: 11,
                shiftedItems: [],
            });
            expect(after(items(["a", 10], ["b", 12]), 10)).toEqual({
                newSequence: 11,
                shiftedItems: [],
            });
        });

        it("uses the following item and not the next one in the list order", () => {
            expect(after(items(["c", 30], ["a", 10], ["b", 20]), 10)).toEqual({
                newSequence: 15,
                shiftedItems: [],
            });
        });

        it("shifts only the consecutive following items, up to the next gap", () => {
            expect(
                after(items(["a", 1], ["b", 2], ["c", 3], ["d", 10]), 1),
            ).toEqual({
                newSequence: 2,
                shiftedItems: [
                    { path: "b", sequence: 3 },
                    { path: "c", sequence: 4 },
                ],
            });
        });

        it("stops shifting as soon as the shifted sequence does not collide", () => {
            expect(
                after(items(["a", 3], ["b", 4], ["c", 5], ["d", 7]), 3),
            ).toEqual({
                newSequence: 4,
                shiftedItems: [
                    { path: "b", sequence: 5 },
                    { path: "c", sequence: 6 },
                ],
            });
        });

        it("shifts all items that share the same sequence", () => {
            expect(after(items(["a", 1], ["b", 2], ["c", 2]), 1)).toEqual({
                newSequence: 2,
                shiftedItems: [
                    { path: "b", sequence: 3 },
                    { path: "c", sequence: 3 },
                ],
            });
        });

        it("keeps the order of following items with sequences that are not integers", () => {
            expect(after(items(["a", 1], ["b", 2], ["c", 2.5]), 1)).toEqual({
                newSequence: 2,
                shiftedItems: [
                    { path: "b", sequence: 3 },
                    { path: "c", sequence: 3.5 },
                ],
            });
        });

        it("does not shift items, if the following item has a sequence that is not an integer and the new one fits before it", () => {
            expect(after(items(["a", 2], ["b", 3.5]), 2)).toEqual({
                newSequence: 3,
                shiftedItems: [],
            });
        });

        it("uses the sequence plus the step if the item is the last one", () => {
            expect(after(items(["a", 1], ["b", 2], ["c", 3]), 3, 1)).toEqual({
                newSequence: 4,
                shiftedItems: [],
            });
            expect(after(items(["a", 10], ["b", 20]), 20, 10)).toEqual({
                newSequence: 30,
                shiftedItems: [],
            });
        });

        it("does not use the step for the sequence if there is a following item", () => {
            expect(after(items(["a", 10], ["b", 20]), 10, 100)).toEqual({
                newSequence: 15,
                shiftedItems: [],
            });
        });
    });

    describe("inserting before an item", () => {
        it("uses the middle between the previous item and the item", () => {
            expect(before(items(["a", 10], ["b", 20]), 20)).toEqual({
                newSequence: 15,
                shiftedItems: [],
            });
        });

        it("shifts the consecutive items, if there is no gap to the previous item", () => {
            expect(
                before(items(["a", 1], ["b", 2], ["c", 3], ["d", 8]), 3),
            ).toEqual({
                newSequence: 3,
                shiftedItems: [{ path: "c", sequence: 4 }],
            });
        });

        it("uses the middle between 0 and the sequence for the first item", () => {
            expect(before(items(["a", 10], ["b", 20]), 10)).toEqual({
                newSequence: 5,
                shiftedItems: [],
            });
            expect(before(items(["a", 2]), 2)).toEqual({
                newSequence: 1,
                shiftedItems: [],
            });
        });

        it("shifts the consecutive items if the first item has the sequence 1", () => {
            expect(before(items(["a", 1], ["b", 2], ["c", 5]), 1)).toEqual({
                newSequence: 1,
                shiftedItems: [
                    { path: "a", sequence: 2 },
                    { path: "b", sequence: 3 },
                ],
            });
        });

        it("does not use sequences below the one of the first item if that one is not positive", () => {
            expect(before(items(["a", 0], ["b", 1]), 0)).toEqual({
                newSequence: 0,
                shiftedItems: [
                    { path: "a", sequence: 1 },
                    { path: "b", sequence: 2 },
                ],
            });
        });
    });

    it("does not modify the passed items", () => {
        const existingItems = items(["a", 1], ["b", 2]);

        after(existingItems, 1);

        expect(existingItems).toEqual(items(["a", 1], ["b", 2]));
    });
});

function items(
    ...entries: [path: string, sequence: number][]
): SequencedItem[] {
    return entries.map(([path, sequence]) => ({ path, sequence }));
}

function append(existingItems: SequencedItem[], sequenceStep: number) {
    return calculateSequenceChangesForInsertion(
        existingItems,
        { type: SequenceInsertionPointType.Append },
        sequenceStep,
    );
}

function after(
    existingItems: SequencedItem[],
    sequence: number,
    sequenceStep = 1,
) {
    return calculateSequenceChangesForInsertion(
        existingItems,
        { type: SequenceInsertionPointType.After, sequence },
        sequenceStep,
    );
}

function before(
    existingItems: SequencedItem[],
    sequence: number,
    sequenceStep = 1,
) {
    return calculateSequenceChangesForInsertion(
        existingItems,
        { type: SequenceInsertionPointType.Before, sequence },
        sequenceStep,
    );
}
