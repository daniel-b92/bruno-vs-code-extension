import { describe, it, expect } from "@jest/globals";
import { readFile } from "fs/promises";
import { join } from "path";
import { useTemporaryDirectories } from "@global_shared/_testingUtils";
import { replaceNameInBrunoJson } from "./replaceNameInBrunoJson";

describe("replaceNameInBrunoJson", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    it("replaces only the name and keeps the indentation", async () => {
        const result = await replaceInFile(
            '{\n  "version": "1",\n  "name": "old",\n  "type": "collection"\n}\n',
            "new",
        );

        expect(result).toBe(
            '{\n  "version": "1",\n  "name": "new",\n  "type": "collection"\n}\n',
        );
    });

    it("keeps CRLF line breaks and tab indentation", async () => {
        const result = await replaceInFile(
            '{\r\n\t"version": "1",\r\n\t"name": "old",\r\n\t"type": "collection"\r\n}',
            "new",
        );

        expect(result).toBe(
            '{\r\n\t"version": "1",\r\n\t"name": "new",\r\n\t"type": "collection"\r\n}',
        );
    });

    it("keeps a single-line format and ignores nested or escaped 'name' keys", async () => {
        const result = await replaceInFile(
            '{"scripts": {"name": "x"}, "a": "\\"name\\": 1", "name":"old\\"q", "z": 1}',
            'n"ew',
        );

        expect(result).toBe(
            '{"scripts": {"name": "x"}, "a": "\\"name\\": 1", "name":"n\\"ew", "z": 1}',
        );
    });

    it("does not touch a file without a name field", async () => {
        const content = '{"version": "1"}';

        expect(await replaceInFile(content, "new")).toBe(content);
    });

    it("does not touch a file with invalid json", async () => {
        const content = '{"name": ';

        expect(await replaceInFile(content, "new")).toBe(content);
    });

    async function replaceInFile(content: string, newName: string) {
        const directory = await createTemporaryDirectory({
            "bruno.json": content,
        });
        const filePath = join(directory, "bruno.json");

        await replaceNameInBrunoJson(filePath, newName);

        return await readFile(filePath, "utf-8");
    }
});
