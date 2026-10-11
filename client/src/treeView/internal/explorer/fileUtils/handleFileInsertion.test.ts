import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { readFile } from "fs/promises";
import { join } from "path";
import { window } from "vscode";
import {
    BrunoFileType,
    CollectionFormat,
    CollectionItem,
} from "@global_shared";
import {
    createCollectionWithEnvironments,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "@shared";
import { handleFileInsertion } from "./handleFileInsertion";
import { RequestFileInsertionPositionType } from "./interfaces";

describe("handleFileInsertion", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("does not rename an existing file at the target path when copying the source file failed", async () => {
        const existingContent =
            "meta {\n  name: unrelated\n  type: http\n  seq: 1\n}\n";
        const directory = await createTemporaryDirectory({
            "target.bru": existingContent,
        });
        const showErrorMessage = jest
            .spyOn(window, "showErrorMessage")
            .mockResolvedValue(undefined);
        const targetPath = join(directory, "target.bru");

        const result = await handleFileInsertion(
            {
                getItemType: () => BrunoFileType.RequestFile,
                // The source file does not exist, so copying it fails.
                getPath: () => join(directory, "missing.bru"),
            } as unknown as CollectionItem,
            {
                insertionPosition: RequestFileInsertionPositionType.Folder,
                newPath: targetPath,
            },
            {
                getAncestorCollectionForPath: () =>
                    createCollectionWithEnvironments(
                        [],
                        CollectionFormat.Bru,
                        directory,
                    ),
            } as unknown as TypedCollectionItemProvider,
        );

        expect(result).toBe(false);
        expect(await readFile(targetPath, "utf-8")).toBe(existingContent);
        expect(showErrorMessage).toHaveBeenCalledTimes(1);
    });
});
