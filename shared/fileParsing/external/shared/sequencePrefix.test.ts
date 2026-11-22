import { describe, it, expect } from "@jest/globals";
import {
    addSequencePrefix,
    doesNameHaveSequencePrefixMatching,
    getMinimumDigitsForSequencePrefix,
    getSequencePrefix,
    parseSequencePrefix,
    removeSequencePrefix,
} from "../../..";

describe("sequencePrefix", () => {
    describe("getMinimumDigitsForSequencePrefix", () => {
        it.each([
            [1, 3],
            [5, 4],
            [10, 4],
            [100, 5],
        ])("uses the expected digits for step %d", (step, expected) => {
            expect(getMinimumDigitsForSequencePrefix(step)).toBe(expected);
        });
    });

    describe("getSequencePrefix", () => {
        it("pads the sequence according to the step", () => {
            expect(getSequencePrefix(10, 10)).toBe("0010_");
            expect(getSequencePrefix(3, 1)).toBe("003_");
            expect(getSequencePrefix(20, 100)).toBe("00020_");
        });

        it("uses more digits if the sequence does not fit", () => {
            expect(getSequencePrefix(1234, 1)).toBe("1234_");
        });
    });

    describe("parseSequencePrefix", () => {
        it("parses a prefix", () => {
            expect(parseSequencePrefix("010_get-token")).toEqual({
                sequence: 10,
                nameWithoutPrefix: "get-token",
            });
        });

        it("only splits off the first prefix", () => {
            expect(parseSequencePrefix("1_2_name")).toEqual({
                sequence: 1,
                nameWithoutPrefix: "2_name",
            });
        });

        it.each(["get-token", "_name", "10name", "010_", "a10_name"])(
            "returns undefined for '%s'",
            (name) => {
                expect(parseSequencePrefix(name)).toBeUndefined();
            },
        );
    });

    describe("removeSequencePrefix", () => {
        it("removes an existing prefix", () => {
            expect(removeSequencePrefix("010_get-token")).toBe("get-token");
        });

        it("keeps names without a prefix", () => {
            expect(removeSequencePrefix("get-token")).toBe("get-token");
        });
    });

    describe("addSequencePrefix", () => {
        it("adds a prefix", () => {
            expect(addSequencePrefix("get-token", 25, 5)).toBe(
                "0025_get-token",
            );
        });

        it("replaces an existing prefix", () => {
            expect(addSequencePrefix("010_get-token", 20, 10)).toBe(
                "0020_get-token",
            );
        });
    });

    describe("doesNameHaveSequencePrefixMatching", () => {
        it("ignores leading zeros", () => {
            expect(doesNameHaveSequencePrefixMatching("10_a", 10)).toBe(true);
            expect(doesNameHaveSequencePrefixMatching("0010_a", 10)).toBe(true);
        });

        it("does not match a different sequence or a missing prefix", () => {
            expect(doesNameHaveSequencePrefixMatching("020_a", 10)).toBe(false);
            expect(doesNameHaveSequencePrefixMatching("a", 10)).toBe(false);
        });
    });
});
