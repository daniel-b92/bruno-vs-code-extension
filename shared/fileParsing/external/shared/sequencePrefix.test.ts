import { describe, it, expect } from "@jest/globals";
import {
    addSequencePrefix,
    canSequenceBeUsedAsPrefix,
    doesNameHaveSequencePrefixMatching,
    getSequencePrefix,
    parseSequencePrefix,
    removeSequencePrefix,
} from "../../..";

describe("sequencePrefix", () => {
    describe("getSequencePrefix", () => {
        it.each([
            [3, "00003_"],
            [10, "00010_"],
            [99900, "99900_"],
        ])("pads the sequence %d to 5 digits", (sequence, expected) => {
            expect(getSequencePrefix(sequence)).toBe(expected);
        });

        it("uses more digits if the sequence does not fit", () => {
            expect(getSequencePrefix(123456)).toBe("123456_");
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
            ["a padded prefix", "010_get-token", {}],
            [
                "a prefix matching the previous sequence",
                "100_get-token",
                { sequence: 3, previousSequence: 100 },
            ],
            [
                "a prefix matching the sequence",
                "10_get-token",
                { sequence: 10 },
            ],
        ])("removes %s", (_, name, expected) => {
            expect(removeSequencePrefix(name, expected)).toBe("get-token");
        });

        it("keeps names without a prefix", () => {
            expect(removeSequencePrefix("get-token", { sequence: 1 })).toBe(
                "get-token",
            );
        });

        it.each(["2024_reports", "10_get-token", "100_login"])(
            "keeps '%s', since its digits match neither the sequence nor the previous one",
            (name) => {
                expect(
                    removeSequencePrefix(name, {
                        sequence: 3,
                        previousSequence: 4,
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
                        storedName,
                    }),
                ).toBe(name.substring(name.indexOf("_") + 1));
            },
        );

        it("removes digits matching the sequence even if they are part of the stored name", () => {
            expect(
                removeSequencePrefix("100_login", {
                    sequence: 100,
                    storedName: "100_login",
                }),
            ).toBe("login");
        });

        it.each([
            ["007_bond", "007_bond"],
            ["007_bond", "007 Bond"],
        ])(
            "keeps the digits of '%s' that are padded with zeros if they are part of the stored name '%s'",
            (name, storedName) => {
                expect(
                    removeSequencePrefix(name, {
                        sequence: 10,
                        storedName,
                    }),
                ).toBe(name);
            },
        );

        it.each([
            ["404_error", 404, "error"],
            ["404_error", 2, "404_error"],
            ["1000_error", 1000, "error"],
            ["404_error", undefined, "404_error"],
        ])(
            "only removes the digits of '%s' with the previous sequence %p if they match it, when the stored name is a different one",
            (name, previousSequence, expected) => {
                expect(
                    removeSequencePrefix(name, {
                        sequence: 3,
                        previousSequence,
                        storedName: "Error 404",
                    }),
                ).toBe(expected);
            },
        );

        it("does not treat names without any letters or digits as the same", () => {
            expect(
                removeSequencePrefix("1000_--", {
                    sequence: 1,
                    storedName: "++",
                }),
            ).toBe("1000_--");
        });

        it("keeps digits matching the previous sequence if they are part of the stored name", () => {
            expect(
                removeSequencePrefix("404_error", {
                    sequence: 3,
                    previousSequence: 404,
                    storedName: "404_error",
                }),
            ).toBe("404_error");
        });
    });

    describe("addSequencePrefix", () => {
        it("adds a prefix", () => {
            expect(
                addSequencePrefix("get-token", {
                    sequence: 25,
                }),
            ).toBe("00025_get-token");
        });

        it("replaces an existing prefix", () => {
            expect(
                addSequencePrefix("010_get-token", {
                    sequence: 20,
                }),
            ).toBe("00020_get-token");
        });

        it("replaces an outdated prefix that matches the previous sequence", () => {
            expect(
                addSequencePrefix("100_login", {
                    sequence: 101,
                    previousSequence: 100,
                }),
            ).toBe("00101_login");
        });

        it("keeps digits that do not look like a prefix as part of the name", () => {
            expect(
                addSequencePrefix("2024_reports", {
                    sequence: 2,
                }),
            ).toBe("00002_2024_reports");
        });
    });

    describe("addSequencePrefix with a stored name", () => {
        it.each([
            ["a lower sequence", "1000_login", 3, "00003_login"],
            ["a higher sequence", "100_login", 1000, "01000_login"],
        ])(
            "replaces a prefix without padding for %s",
            (_, name, sequence, expected) => {
                expect(
                    addSequencePrefix(name, {
                        sequence,
                        storedName: "login",
                    }),
                ).toBe(expected);
            },
        );

        it("keeps digits that are part of the stored name", () => {
            const data = {
                sequence: 1,
                storedName: "404_error",
            };
            const withPrefix = addSequencePrefix("404_error", data);

            expect(withPrefix).toBe("00001_404_error");
            expect(addSequencePrefix(withPrefix, data)).toBe(withPrefix);
        });

        it("keeps digits padded with zeros that are part of the stored name", () => {
            const data = {
                sequence: 10,
                storedName: "007_bond",
            };
            const withPrefix = addSequencePrefix("007_bond", data);

            expect(withPrefix).toBe("00010_007_bond");
            expect(addSequencePrefix(withPrefix, data)).toBe(withPrefix);
            expect(
                addSequencePrefix(withPrefix, {
                    ...data,
                    sequence: 20,
                    previousSequence: 10,
                }),
            ).toBe("00020_007_bond");
        });
    });

    describe("doesNameHaveSequencePrefixMatching", () => {
        it("matches the prefix for the sequence", () => {
            expect(doesNameHaveSequencePrefixMatching("00010_a", 10)).toBe(
                true,
            );
            expect(doesNameHaveSequencePrefixMatching("123456_a", 123456)).toBe(
                true,
            );
        });

        it("does not match a different number of leading zeros", () => {
            expect(doesNameHaveSequencePrefixMatching("10_a", 10)).toBe(false);
            expect(doesNameHaveSequencePrefixMatching("0010_a", 10)).toBe(
                false,
            );
            expect(doesNameHaveSequencePrefixMatching("000010_a", 10)).toBe(
                false,
            );
        });

        it("does not match a name that consists only of the prefix", () => {
            expect(doesNameHaveSequencePrefixMatching("00010_", 10)).toBe(
                false,
            );
        });

        it("does not match a different sequence or a missing prefix", () => {
            expect(doesNameHaveSequencePrefixMatching("020_a", 10)).toBe(false);
            expect(doesNameHaveSequencePrefixMatching("a", 10)).toBe(false);
        });
    });
});
