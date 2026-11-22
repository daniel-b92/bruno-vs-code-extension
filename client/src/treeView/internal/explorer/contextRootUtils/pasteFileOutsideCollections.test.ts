import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { readFile } from "fs/promises";
import { join } from "path";
import { window } from "vscode";
import { useTemporaryDirectories } from "@global_shared/_testingUtils";
import { pasteFileOutsideCollections } from "./pasteFileOutsideCollections";

describe("pasteFileOutsideCollections", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("writes the given content to the target path", async () => {
        const directory = await createTemporaryDirectory({
            "source.js": "from disk",
        });

        const result = await pasteFileOutsideCollections(
            join(directory, "source.js"),
            join(directory, "target.js"),
            "copied content",
        );

        expect(result).toBe(true);
        expect(await readFile(join(directory, "target.js"), "utf-8")).toBe(
            "copied content",
        );
    });

    it("copies the source file if there is no content", async () => {
        const directory = await createTemporaryDirectory({
            "source.js": "from disk",
        });

        const result = await pasteFileOutsideCollections(
            join(directory, "source.js"),
            join(directory, "target.js"),
        );

        expect(result).toBe(true);
        expect(await readFile(join(directory, "target.js"), "utf-8")).toBe(
            "from disk",
        );
    });

    it("shows an error if the file could not be written", async () => {
        const directory = await createTemporaryDirectory({});
        const showErrorMessage = jest
            .spyOn(window, "showErrorMessage")
            .mockResolvedValue(undefined);

        const result = await pasteFileOutsideCollections(
            join(directory, "source.js"),
            join(directory, "missingFolder", "target.js"),
            "content",
        );

        expect(result).toBe(false);
        expect(showErrorMessage).toHaveBeenCalledTimes(1);
    });
});
