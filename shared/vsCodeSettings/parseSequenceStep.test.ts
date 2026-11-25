import { describe, it, expect } from "@jest/globals";
import { parseSequenceStep } from "..";

describe("parseSequenceStep", () => {
    it("returns a valid step", () => {
        expect(parseSequenceStep(10)).toBe(10);
    });

    it.each([undefined, 0, -5, 2.5, "10", null])(
        "falls back to 1 for the invalid value %p",
        (value) => {
            expect(parseSequenceStep(value)).toBe(1);
        },
    );
});
