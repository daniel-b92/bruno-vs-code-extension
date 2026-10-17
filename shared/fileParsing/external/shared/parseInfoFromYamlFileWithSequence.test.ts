import { describe, it, expect } from "@jest/globals";
import {
    parseInfoFromYamlFileWithSequence,
    TextDocumentHelper,
} from "../../..";

describe("parseInfoFromYamlFileWithSequence", () => {
    it("parses the info section of an app file without errors", () => {
        const content = [
            "info:",
            "  name: my app",
            "  type: app",
            "  seq: 3",
        ].join("\n");

        const { errors, result } = parseInfoFromYamlFileWithSequence(
            "app.yml",
            new TextDocumentHelper(content),
        );

        expect(errors).toEqual([]);
        expect(result?.properties.sequence?.value).toBe(3);
        expect(result?.properties.type?.value).toBe("app");
    });

    it("parses the info section of a request file without errors", () => {
        const content = [
            "info:",
            "  name: my request",
            "  type: http",
            "  seq: 2",
            "",
            "http:",
            "  method: GET",
            "  url: http://localhost",
        ].join("\n");

        const { errors, result } = parseInfoFromYamlFileWithSequence(
            "request.yml",
            new TextDocumentHelper(content),
        );

        expect(errors).toEqual([]);
        expect(result?.properties.sequence?.value).toBe(2);
    });

    it("parses the info section of a folder settings file without errors", () => {
        const content = [
            "info:",
            "  name: my folder",
            "  type: folder",
            "  seq: 4",
        ].join("\n");

        const { errors, result } = parseInfoFromYamlFileWithSequence(
            "folder.yml",
            new TextDocumentHelper(content),
        );

        expect(errors).toEqual([]);
        expect(result?.properties.sequence?.value).toBe(4);
    });
});
