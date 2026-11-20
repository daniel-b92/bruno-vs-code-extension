import { describe, it, expect } from "@jest/globals";
import { YamlParsingError, YamlParsingErrorCode } from "../../../..";
import { makeCommonParsingArgs } from "../../../../_testingUtils";
import { parseIfPresent } from "./parseIfPresent";

describe("parseIfPresent", () => {
    it("returns the parsed result and collects the errors", () => {
        const collectedErrors: YamlParsingError[] = [];
        const error = createError();

        const result = parseIfPresent(
            "foo",
            (item) => ({ result: item.toUpperCase(), errors: [error] }),
            collectedErrors,
        );

        expect(result).toBe("FOO");
        expect(collectedErrors).toEqual([error]);
    });

    it("does not call the parser, if the item is undefined", () => {
        const collectedErrors: YamlParsingError[] = [];
        let wasCalled = false;

        const result = parseIfPresent(
            undefined,
            () => {
                wasCalled = true;
                return { result: "foo", errors: [] };
            },
            collectedErrors,
        );

        expect(result).toBeUndefined();
        expect(wasCalled).toBe(false);
        expect(collectedErrors).toEqual([]);
    });

    it("still collects the errors, if the parser returns no result", () => {
        const collectedErrors: YamlParsingError[] = [];
        const error = createError();

        const result = parseIfPresent(
            "foo",
            () => ({ errors: [error] }),
            collectedErrors,
        );

        expect(result).toBeUndefined();
        expect(collectedErrors).toEqual([error]);
    });
});

function createError(): YamlParsingError {
    return {
        message: "error",
        range: makeCommonParsingArgs("").fullDocumentRange,
        code: YamlParsingErrorCode.Other,
    };
}
