import { describe, expect, it } from "@jest/globals";
import { getHoverForDynamicBrunoVariable } from "./getHoverForDynamicBrunoVariable";

describe("getHoverForDynamicBrunoVariable", () => {
    it("returns the description and an example for a dynamic variable", () => {
        expect(getHoverForDynamicBrunoVariable("$timestamp")).toEqual({
            contents: {
                kind: "markdown",
                value: "Current timestamp in seconds. Example: `1562757107`",
            },
        });
    });

    it.each(["$randomInts", "$RandomInt", "$", "timestamp", "$constructor"])(
        "returns no hover for the unknown name '%s'",
        (name) => {
            expect(getHoverForDynamicBrunoVariable(name)).toBeUndefined();
        },
    );
});
