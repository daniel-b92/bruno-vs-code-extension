import { describe, it, expect } from "@jest/globals";
import { readFile } from "fs/promises";
import { join } from "path";
import { CollectionFormat } from "@global_shared";
import { useTemporaryDirectories } from "@global_shared/_testingUtils";
import { setSequenceForFolder } from "./setSequenceForFolder";

describe("setSequenceForFolder", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    describe("Bru format", () => {
        it("creates a minimal folder settings file, if there is none", async () => {
            const directory = await createTemporaryDirectory({
                "my-folder/request.bru": "",
            });

            const result = await set(directory, 5, CollectionFormat.Bru);

            expect(result).toBe(true);
            expect(await read(directory, "folder.bru")).toBe(
                "meta {\n  name: my-folder\n  seq: 5\n}\n",
            );
        });

        it("only replaces the sequence, if there is one", async () => {
            const content =
                "meta {\n  name: my-folder\n  seq: 1\n}\n\nvars:pre-request {\n  keepMe: 1\n}\n";
            const directory = await createFolderWithSettings(
                "folder.bru",
                content,
            );

            const result = await set(directory, 5, CollectionFormat.Bru);

            expect(result).toBe(true);
            expect(await read(directory, "folder.bru")).toBe(
                content.replace("seq: 1", "seq: 5"),
            );
        });

        it("adds the sequence to an existing meta block, keeping the other content", async () => {
            const directory = await createFolderWithSettings(
                "folder.bru",
                "meta {\n  name: my-folder\n}\n\nvars:pre-request {\n  keepMe: 1\n}\n",
            );

            const result = await set(directory, 5, CollectionFormat.Bru);

            expect(result).toBe(true);
            expect(await read(directory, "folder.bru")).toBe(
                "meta {\n  seq: 5\n  name: my-folder\n}\n\nvars:pre-request {\n  keepMe: 1\n}\n",
            );
        });

        it("keeps the line endings of the file", async () => {
            const directory = await createFolderWithSettings(
                "folder.bru",
                "meta {\r\n  name: my-folder\r\n}\r\n",
            );

            await set(directory, 5, CollectionFormat.Bru);

            expect(await read(directory, "folder.bru")).toBe(
                "meta {\r\n  seq: 5\r\n  name: my-folder\r\n}\r\n",
            );
        });

        it("adds a meta block in front of the other content, if there is none", async () => {
            const directory = await createFolderWithSettings(
                "folder.bru",
                "headers {\n  a: b\n}\n",
            );

            const result = await set(directory, 5, CollectionFormat.Bru);

            expect(result).toBe(true);
            expect(await read(directory, "folder.bru")).toBe(
                "meta {\n  name: my-folder\n  seq: 5\n}\n\nheaders {\n  a: b\n}\n",
            );
        });
    });

    describe("Yaml format", () => {
        it("creates a minimal folder settings file, if there is none", async () => {
            const directory = await createTemporaryDirectory({
                "my-folder/request.yml": "",
            });

            const result = await set(directory, 5, CollectionFormat.Yaml);

            expect(result).toBe(true);
            expect(await read(directory, "folder.yml")).toBe(
                "info:\n  name: my-folder\n  type: folder\n  seq: 5\n",
            );
        });

        it("only replaces the sequence, if there is one", async () => {
            const content =
                "info:\n  name: my-folder\n  type: folder\n  seq: 1\nrequest:\n  headers: []\n";
            const directory = await createFolderWithSettings(
                "folder.yml",
                content,
            );

            const result = await set(directory, 5, CollectionFormat.Yaml);

            expect(result).toBe(true);
            expect(await read(directory, "folder.yml")).toBe(
                content.replace("seq: 1", "seq: 5"),
            );
        });

        it("adds the sequence to the existing info section with the same indentation", async () => {
            const directory = await createFolderWithSettings(
                "folder.yml",
                "info:\n    name: my-folder\n    type: folder\nrequest:\n  headers: []\n",
            );

            const result = await set(directory, 5, CollectionFormat.Yaml);

            expect(result).toBe(true);
            expect(await read(directory, "folder.yml")).toBe(
                "info:\n    seq: 5\n    name: my-folder\n    type: folder\nrequest:\n  headers: []\n",
            );
        });

        it("adds an info section in front of the other content, if there is none", async () => {
            const directory = await createFolderWithSettings(
                "folder.yml",
                "request:\n  headers: []\n",
            );

            const result = await set(directory, 5, CollectionFormat.Yaml);

            expect(result).toBe(true);
            expect(await read(directory, "folder.yml")).toBe(
                "info:\n  name: my-folder\n  type: folder\n  seq: 5\n\nrequest:\n  headers: []\n",
            );
        });

        it("does not change the file and reports a failure for an unsupported info notation", async () => {
            const content = "info: {}\n";
            const directory = await createFolderWithSettings(
                "folder.yml",
                content,
            );

            const result = await set(directory, 5, CollectionFormat.Yaml);

            expect(result).toBe(false);
            expect(await read(directory, "folder.yml")).toBe(content);
        });
    });

    async function createFolderWithSettings(fileName: string, content: string) {
        return await createTemporaryDirectory({
            [`my-folder/${fileName}`]: content,
        });
    }

    async function set(
        directory: string,
        sequence: number,
        format: CollectionFormat,
    ) {
        return await setSequenceForFolder(
            join(directory, "my-folder"),
            sequence,
            format,
        );
    }

    async function read(directory: string, fileName: string) {
        return await readFile(join(directory, "my-folder", fileName), "utf-8");
    }
});
