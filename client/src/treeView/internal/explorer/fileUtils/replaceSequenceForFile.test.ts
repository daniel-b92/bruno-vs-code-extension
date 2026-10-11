import { describe, it, expect } from "@jest/globals";
import { readFile } from "fs/promises";
import { join } from "path";
import { useTemporaryDirectories } from "@global_shared/_testingUtils";
import { replaceSequenceForFile } from "./replaceSequenceForFile";

describe("replaceSequenceForFile", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    it("replaces only the sequence in the meta block of a bru file", async () => {
        const content = [
            "meta {",
            "  name: my request",
            "  type: http",
            "  seq: 3",
            "}",
            "",
            "docs {",
            "  seq: 3",
            "}",
            "",
        ].join("\n");

        expect(await replaceInFile("request.bru", content, 10)).toBe(
            content.replace("  seq: 3\n}\n\ndocs", "  seq: 10\n}\n\ndocs"),
        );
    });

    it("keeps the empty lines of a yaml request file", async () => {
        const content = [
            "info:",
            "  name: my request",
            "  type: http",
            "  seq: 3",
            "",
            "http:",
            "  method: GET",
            '  url: ""',
            "",
        ].join("\n");

        expect(await replaceInFile("request.yml", content, 4)).toBe(
            content.replace("seq: 3", "seq: 4"),
        );
    });

    it("replaces only the sequence within the info block of a yaml file", async () => {
        const content = [
            "info:",
            "  name: my request",
            "  type: http",
            "  seq: 3 # Comment",
            "",
            "http:",
            "  method: GET",
            "  url: http://localhost",
            "  headers:",
            "    - name: seq",
            "      value: 3",
            "docs: |",
            "  seq: 3",
            "",
        ].join("\n");

        expect(await replaceInFile("request.yml", content, 1)).toBe(
            content.replace("seq: 3 # Comment", "seq: 1 # Comment"),
        );
    });

    it("replaces the sequence in a yaml folder settings file", async () => {
        const content = [
            "info:",
            "  name: my folder",
            "  type: folder",
            "  seq: 2",
            "",
        ].join("\n");

        expect(await replaceInFile("folder.yml", content, 5)).toBe(
            content.replace("seq: 2", "seq: 5"),
        );
    });

    it("does not change a file without sequence", async () => {
        const content = [
            "info:",
            "  name: my request",
            "  type: http",
            "",
            "http:",
            "  method: GET",
            "",
        ].join("\n");

        expect(await replaceInFile("request.yml", content, 5)).toBe(content);
    });

    async function replaceInFile(
        fileName: string,
        content: string,
        newSequence: number,
    ) {
        const directory = await createTemporaryDirectory({
            [fileName]: content,
        });

        await replaceSequenceForFile(join(directory, fileName), newSequence);

        return await readFile(join(directory, fileName), "utf-8");
    }
});
