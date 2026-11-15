import { describe, expect, it } from "@jest/globals";
import { getMarkdownForDynamicBrunoVariable } from "./getMarkdownForDynamicBrunoVariable";

describe("getMarkdownForDynamicBrunoVariable", () => {
    it("shows a single example in singular form", () => {
        expect(
            getMarkdownForDynamicBrunoVariable({
                name: "$timestamp",
                description: "Current timestamp in seconds",
                examples: ["1562757107"],
            }),
        ).toBe("Current timestamp in seconds. Example: `1562757107`");
    });

    it("shows each of multiple examples in its own code span", () => {
        expect(
            getMarkdownForDynamicBrunoVariable({
                name: "$randomBoolean",
                description: "A random boolean value",
                examples: ["true", "false"],
            }),
        ).toBe("A random boolean value. Examples: `true`, `false`");
    });
});
