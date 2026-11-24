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
                digits: "010",
                sequence: 10,
                nameWithoutPrefix: "get-token",
            });
        });

        it("only splits off the first prefix", () => {
            expect(parseSequencePrefix("1_2_name")).toEqual({
                digits: "1",
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
        it.each([
            ["a padded prefix", "010_get-token", { sequenceStep: 10 }],
            [
                "a prefix with the digits for the step",
                "100_get-token",
                { sequenceStep: 1 },
            ],
            [
                "a prefix matching the sequence",
                "10_get-token",
                { sequence: 10, sequenceStep: 1 },
            ],
        ])("removes %s", (_, name, expected) => {
            expect(removeSequencePrefix(name, expected)).toBe("get-token");
        });

        it("keeps names without a prefix", () => {
            expect(removeSequencePrefix("get-token", { sequenceStep: 1 })).toBe(
                "get-token",
            );
        });

        it.each(["2024_reports", "10_get-token"])(
            "keeps '%s', since its digits do not look like a generated prefix",
            (name) => {
                expect(
                    removeSequencePrefix(name, {
                        sequence: 3,
                        sequenceStep: 1,
                    }),
                ).toBe(name);
            },
        );
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

        it("replaces an outdated prefix with the digits for the step", () => {
            expect(addSequencePrefix("100_login", 101, 1)).toBe("101_login");
        });

        it("keeps digits that do not look like a prefix as part of the name", () => {
            expect(addSequencePrefix("2024_reports", 2, 1)).toBe(
                "002_2024_reports",
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
