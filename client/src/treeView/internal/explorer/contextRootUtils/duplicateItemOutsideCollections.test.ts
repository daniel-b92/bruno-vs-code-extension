import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { readFile } from "fs/promises";
import { join } from "path";
import { window } from "vscode";
import { useTemporaryDirectories } from "@global_shared/_testingUtils";
import { duplicateItemOutsideCollections } from "./duplicateItemOutsideCollections";

describe("duplicateItemOutsideCollections", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("copies a file", async () => {
        const directory = await createTemporaryDirectory({ "a.js": "content" });

        const result = await duplicateItemOutsideCollections(
            join(directory, "a.js"),
            join(directory, "a_Copy.js"),
        );

        expect(result).toBe(true);
        expect(await readFile(join(directory, "a_Copy.js"), "utf-8")).toBe(
            "content",
        );
    });

    it("copies a folder recursively", async () => {
        const directory = await createTemporaryDirectory({
            "folder/sub/a.js": "content",
        });

        const result = await duplicateItemOutsideCollections(
            join(directory, "folder"),
            join(directory, "folder_Copy"),
        );

        expect(result).toBe(true);
        expect(
            await readFile(join(directory, "folder_Copy/sub/a.js"), "utf-8"),
        ).toBe("content");
    });

    it("does not overwrite an existing item and shows an error", async () => {
        const directory = await createTemporaryDirectory({
            "a.js": "new",
            "b.js": "existing",
        });
        const showErrorMessage = jest
            .spyOn(window, "showErrorMessage")
            .mockResolvedValue(undefined);

        const result = await duplicateItemOutsideCollections(
            join(directory, "a.js"),
            join(directory, "b.js"),
        );

        expect(result).toBe(false);
        expect(await readFile(join(directory, "b.js"), "utf-8")).toBe(
            "existing",
        );
        expect(showErrorMessage).toHaveBeenCalledTimes(1);
    });
});
