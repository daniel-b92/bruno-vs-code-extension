import { describe, it, expect } from "@jest/globals";
import { parseDocumentIntoYamlMap } from "./parseDocumentIntoYamlMap";
import { makeCommonParsingArgs } from "../../../../_testingUtils";

describe("parseDocumentIntoYamlMap", () => {
    const textWithSyntaxError = "info:\n  name: a\nhttp:\n  url: {{";

    it("should return the syntax errors by default", () => {
        const result = parseDocumentIntoYamlMap(
            makeCommonParsingArgs(textWithSyntaxError),
        );

        expect(result).toHaveProperty("errors");
    });

    it("should return the map, if syntax errors should be ignored", () => {
        const result = parseDocumentIntoYamlMap({
            ...makeCommonParsingArgs(textWithSyntaxError),
            continueOnSyntaxErrors: true,
        });

        expect(result).toHaveProperty("map");
        expect(
            "map" in result && result.map.items.map(({ key }) => String(key)),
        ).toEqual(["info", "http"]);
    });
});
