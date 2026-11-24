import { describe, it, expect } from "@jest/globals";
import { join } from "path";
import {
    getStoredItemNameFromFile,
    getStoredItemNameFromFileContent,
} from "../../..";
import { useTemporaryDirectories } from "../../../_testingUtils";

describe("getStoredItemNameFromFileContent", () => {
    it.each([
        [
            "a bru request file",
            "request.bru",
            "meta {\n  name: Get token\n  type: http\n  seq: 1\n}\n",
            "Get token",
        ],
        [
            "a bru folder settings file",
            "folder.bru",
            "meta {\n  name: users\n  seq: 1\n}\n",
            "users",
        ],
        [
            "a bru file without a name",
            "request.bru",
            "meta {\n  type: http\n}\n",
            undefined,
        ],
        [
            "a bru file without a meta block",
            "request.bru",
            "get {\n  url: \n}\n",
            undefined,
        ],
        [
            "a yaml request file",
            "request.yml",
            "info:\n  name: Get token\n  type: http\n  seq: 1\n",
            "Get token",
        ],
        [
            "a yaml app file with a quoted name",
            "app.yml",
            'info:\n  name: "404_app"\n  type: app\n  seq: 1\n',
            "404_app",
        ],
        [
            "a yaml folder settings file",
            "folder.yml",
            "info:\n  name: users\n  type: folder\n  seq: 1\n",
            "users",
        ],
        [
            "a yaml file without a name",
            "request.yml",
            "info:\n  type: http\n",
            undefined,
        ],
        ["an invalid yaml file", "request.yml", "info: [", undefined],
        ["another file type", "script.js", "name: x", undefined],
    ])("determines the name of %s", (_, filePath, content, expected) => {
        expect(getStoredItemNameFromFileContent(filePath, content)).toBe(
            expected,
        );
    });
});

describe("getStoredItemNameFromFile", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    it("determines the name from the file content", async () => {
        const directory = await createTemporaryDirectory({
            "request.bru": "meta {\n  name: login\n  type: http\n}\n",
        });

        expect(
            await getStoredItemNameFromFile(join(directory, "request.bru")),
        ).toBe("login");
    });

    it("returns undefined for a missing file", async () => {
        const directory = await createTemporaryDirectory();

        expect(
            await getStoredItemNameFromFile(join(directory, "missing.bru")),
        ).toBeUndefined();
    });
});
