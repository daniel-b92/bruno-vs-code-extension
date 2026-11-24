import { describe, it, expect } from "@jest/globals";
import {
    addSequencePrefix,
    canSequenceBeUsedAsPrefix,
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

    describe("canSequenceBeUsedAsPrefix", () => {
        it.each([0, 1, 1000])("accepts %d", (sequence) => {
            expect(canSequenceBeUsedAsPrefix(sequence)).toBe(true);
        });

        it.each([-1, 1.5, NaN, Infinity, 1e21])("rejects %d", (sequence) => {
            expect(canSequenceBeUsedAsPrefix(sequence)).toBe(false);
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

        it.each([
            ["404_not-found", "404_not-found"],
            ["404_not-found", "404 Not found"],
            ["100_login", "100_login"],
        ])(
            "keeps the digits of '%s' if they are part of the stored name '%s'",
            (name, storedName) => {
                expect(
                    removeSequencePrefix(name, {
                        sequence: 3,
                        sequenceStep: 1,
                        storedName,
                    }),
                ).toBe(name);
            },
        );

        it.each([
            ["1000_login", "login"],
            ["1000_get-token", "Get token"],
            ["12_login", "login"],
        ])(
            "removes the digits of '%s' if the stored name is '%s', regardless of the number of digits",
            (name, storedName) => {
                expect(
                    removeSequencePrefix(name, {
                        sequence: 3,
                        sequenceStep: 1,
                        storedName,
                    }),
                ).toBe(name.substring(name.indexOf("_") + 1));
            },
        );

        it.each([
            ["matching the sequence", "100_login", 100],
            ["padded with zeros", "001_login", 3],
        ])(
            "removes digits %s even if they are part of the stored name",
            (_, name, sequence) => {
                expect(
                    removeSequencePrefix(name, {
                        sequence,
                        sequenceStep: 1,
                        storedName: name,
                    }),
                ).toBe("login");
            },
        );

        it.each([
            ["100_login", "login"],
            ["1000_login", "1000_login"],
        ])(
            "considers the number of digits of '%s' if the stored name is a different one",
            (name, expected) => {
                expect(
                    removeSequencePrefix(name, {
                        sequence: 3,
                        sequenceStep: 1,
                        storedName: "Something else",
                    }),
                ).toBe(expected);
            },
        );

        it("does not treat names without any letters or digits as the same", () => {
            expect(
                removeSequencePrefix("1000_--", {
                    sequenceStep: 1,
                    storedName: "++",
                }),
            ).toBe("1000_--");
        });

        it("does not consider the number of digits without a step", () => {
            expect(removeSequencePrefix("404_not-found", { sequence: 3 })).toBe(
                "404_not-found",
            );
        });
    });

    describe("addSequencePrefix", () => {
        it("adds a prefix", () => {
            expect(
                addSequencePrefix("get-token", {
                    sequence: 25,
                    sequenceStep: 5,
                }),
            ).toBe("0025_get-token");
        });

        it("replaces an existing prefix", () => {
            expect(
                addSequencePrefix("010_get-token", {
                    sequence: 20,
                    sequenceStep: 10,
                }),
            ).toBe("0020_get-token");
        });

        it("replaces an outdated prefix with the digits for the step", () => {
            expect(
                addSequencePrefix("100_login", {
                    sequence: 101,
                    sequenceStep: 1,
                }),
            ).toBe("101_login");
        });

        it("keeps digits that do not look like a prefix as part of the name", () => {
            expect(
                addSequencePrefix("2024_reports", {
                    sequence: 2,
                    sequenceStep: 1,
                }),
            ).toBe("002_2024_reports");
        });
    });

    describe("addSequencePrefix with a stored name", () => {
        it.each([
            ["a lower sequence", "1000_login", 3, 1, "003_login"],
            ["a smaller step", "1000_login", 100, 1, "100_login"],
            ["a larger step", "100_login", 1000, 10, "1000_login"],
        ])(
            "replaces a prefix without padding for %s",
            (_, name, sequence, sequenceStep, expected) => {
                expect(
                    addSequencePrefix(name, {
                        sequence,
                        sequenceStep,
                        storedName: "login",
                    }),
                ).toBe(expected);
            },
        );

        it("keeps digits that are part of the stored name", () => {
            const data = {
                sequence: 1,
                sequenceStep: 1,
                storedName: "404_error",
            };
            const withPrefix = addSequencePrefix("404_error", data);

            expect(withPrefix).toBe("001_404_error");
            expect(addSequencePrefix(withPrefix, data)).toBe(withPrefix);
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
