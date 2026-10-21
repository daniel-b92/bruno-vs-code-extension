import { describe, it, expect } from "@jest/globals";
import { BrunoFileType, Position, TextDocumentHelper } from "../../..";
import { getYamlKeyInfoAtPosition } from "./getYamlKeyInfoAtPosition";

describe("getYamlKeyInfoAtPosition", () => {
    it("returns the info of a key in a nested map", () => {
        const text = `http:
  method: GET
  url: x
`;

        const result = getKeyInfo(text, new Position(1, 4));

        expect(result?.keyInfo.key).toBe("method");
        expect(result?.keyInfo.isMandatory).toBe(false);
    });

    it("returns the allowed values of a key", () => {
        const text = `info:
  name: Foo
  type: http
`;

        const result = getKeyInfo(text, new Position(2, 4));

        expect(result?.keyInfo.key).toBe("type");
        expect(result?.keyInfo.allowedValues).toContain("http");
    });

    it("returns the info of a top level key", () => {
        const text = `http:
  method: GET
  url: x
`;

        expect(getKeyInfo(text, new Position(0, 1))?.keyInfo.key).toBe("http");
    });

    it("returns the info of a key within a sequence item", () => {
        const text = `http:
  method: GET
  url: x
  headers:
    - name: a
      value: b
`;

        expect(getKeyInfo(text, new Position(5, 8))?.keyInfo.key).toBe("value");
    });

    it("returns undefined for an unknown key", () => {
        const text = `http:
  method: GET
  foo: x
`;

        expect(getKeyInfo(text, new Position(2, 3))).toBeUndefined();
    });

    it("returns undefined for a position within a value", () => {
        const text = `http:
  method: GET
`;

        expect(getKeyInfo(text, new Position(1, 12))).toBeUndefined();
    });
});

function getKeyInfo(text: string, position: Position) {
    return getYamlKeyInfoAtPosition({
        docHelper: new TextDocumentHelper(text),
        fileType: BrunoFileType.RequestFile,
        position,
    });
}
