import { describe, it, expect } from "@jest/globals";
import {
    getSequenceValueRangeFromFileContent,
    Position,
    Range,
} from "../../..";

describe("getSequenceValueRangeFromFileContent", () => {
    it("finds the sequence in the meta block of a bru file", () => {
        const content = [
            "meta {",
            "  name: my request",
            "  type: http",
            "  seq: 12",
            "}",
            "",
            "get {",
            "  url: http://localhost",
            "}",
        ].join("\n");

        expect(
            getSequenceValueRangeFromFileContent("request.bru", content),
        ).toEqual(new Range(new Position(3, 7), new Position(3, 9)));
    });

    it("ignores a disabled sequence field and matching text outside of the meta block in a bru file", () => {
        const content = [
            "meta {",
            "  name: my request",
            "  ~seq: 3",
            "}",
            "",
            "docs {",
            "  seq: 5",
            "}",
        ].join("\n");

        expect(
            getSequenceValueRangeFromFileContent("request.bru", content),
        ).toBeUndefined();
    });

    it("finds the sequence in the info block of a yaml request file", () => {
        const content = [
            "info:",
            "  name: my request",
            "  type: http",
            "  seq: 7",
            "",
            "http:",
            "  method: GET",
            "  url: http://localhost",
        ].join("\n");

        expect(
            getSequenceValueRangeFromFileContent("request.yml", content),
        ).toEqual(new Range(new Position(3, 7), new Position(3, 8)));
    });

    it("finds the sequence in the info block of a yaml folder settings file", () => {
        const content = [
            "info:",
            "  name: my folder",
            "  type: folder",
            "  seq: 4",
        ].join("\n");

        expect(
            getSequenceValueRangeFromFileContent("folder.yml", content),
        ).toEqual(new Range(new Position(3, 7), new Position(3, 8)));
    });

    it("returns undefined for a yaml file without sequence", () => {
        const content = [
            "info:",
            "  name: my request",
            "  type: http",
            "",
            "http:",
            "  method: GET",
            "  url: http://localhost",
        ].join("\n");

        expect(
            getSequenceValueRangeFromFileContent("request.yml", content),
        ).toBeUndefined();
    });

    it("returns undefined for an unsupported file extension", () => {
        expect(
            getSequenceValueRangeFromFileContent("request.txt", "seq: 1"),
        ).toBeUndefined();
    });
});
