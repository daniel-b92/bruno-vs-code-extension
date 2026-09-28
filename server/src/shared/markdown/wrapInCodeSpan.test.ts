import { describe, it, expect } from "@jest/globals";
import { wrapInCodeSpan } from "./wrapInCodeSpan";

describe("wrapInCodeSpan", () => {
    it("wraps plain content in a single-backtick fence", () => {
        expect(wrapInCodeSpan("plain-value")).toBe("`plain-value`");
    });

    it("uses a double-backtick fence when the content contains a single backtick", () => {
        expect(wrapInCodeSpan("has`backtick")).toBe("``has`backtick``");
    });

    it("uses a triple-backtick fence when the content contains a double backtick", () => {
        expect(wrapInCodeSpan("has``double")).toBe("```has``double```");
    });

    it("pads with a space when the content starts and ends with a backtick", () => {
        expect(wrapInCodeSpan("`leading-and-trailing`")).toBe(
            "`` `leading-and-trailing` ``",
        );
    });

    it("pads with a space when the content only starts with a backtick", () => {
        expect(wrapInCodeSpan("`leading")).toBe("`` `leading ``");
    });

    it("pads with a space when the content only ends with a backtick", () => {
        expect(wrapInCodeSpan("trailing`")).toBe("`` trailing` ``");
    });
});
