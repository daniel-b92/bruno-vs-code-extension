import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { join } from "path";
import { rename } from "fs/promises";
import { workspace, WorkspaceEdit } from "vscode";
import {
    BrunoRequestFile,
    CollectionDirectory,
    CollectionFormat,
    checkIfPathExistsAsync,
} from "@global_shared";
import {
    createCollectionWithItems,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "@shared";
import { removeSequencePrefixesRecursively } from "./removeSequencePrefixesRecursively";

describe("removeSequencePrefixesRecursively", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("removes the prefixes below the selected folder, but keeps the folder itself", async () => {
        jest.spyOn(workspace, "applyEdit").mockImplementation(applyRenames);
        const directory = await createTemporaryDirectory({
            "010_a.bru": requestContent(10),
            "020_users/folder.bru": "meta {\n  name: users\n  seq: 20\n}\n",
            "020_users/005_b.bru": requestContent(5),
            "020_users/030_nested/folder.bru":
                "meta {\n  name: nested\n  seq: 30\n}\n",
            "020_users/030_nested/001_c.bru": requestContent(1),
        });
        const { collection, itemProvider } =
            createCollectionWithItems<TypedCollectionItemProvider>(
                [
                    new BrunoRequestFile(join(directory, "010_a.bru"), 10),
                    new CollectionDirectory(
                        join(directory, "020_users"),
                        join(directory, "020_users", "folder.bru"),
                        20,
                    ),
                    new BrunoRequestFile(
                        join(directory, "020_users", "005_b.bru"),
                        5,
                    ),
                    new CollectionDirectory(
                        join(directory, "020_users", "030_nested"),
                        join(
                            directory,
                            "020_users",
                            "030_nested",
                            "folder.bru",
                        ),
                        30,
                    ),
                    new BrunoRequestFile(
                        join(directory, "020_users", "030_nested", "001_c.bru"),
                        1,
                    ),
                ],
                CollectionFormat.Bru,
                [],
                directory,
            );

        const renamedCount = await removeSequencePrefixesRecursively(
            itemProvider,
            collection,
            join(directory, "020_users"),
        );

        expect(renamedCount).toBe(3);
        expect(
            await Promise.all(
                ["010_a.bru", "020_users/b.bru", "020_users/nested/c.bru"].map(
                    (path) => checkIfPathExistsAsync(join(directory, path)),
                ),
            ),
        ).toEqual([true, true, true]);
    });

    it("does not overwrite existing items", async () => {
        const applyEdit = jest
            .spyOn(workspace, "applyEdit")
            .mockImplementation(applyRenames);
        const directory = await createTemporaryDirectory({
            "010_a.bru": requestContent(10),
            "a.bru": "other",
        });
        const { collection, itemProvider } =
            createCollectionWithItems<TypedCollectionItemProvider>(
                [new BrunoRequestFile(join(directory, "010_a.bru"), 10)],
                CollectionFormat.Bru,
                [],
                directory,
            );

        const renamedCount = await removeSequencePrefixesRecursively(
            itemProvider,
            collection,
            directory,
        );

        expect(renamedCount).toBe(0);
        expect(applyEdit).not.toHaveBeenCalled();
    });
});

function requestContent(sequence: number) {
    return `meta {\n  name: request\n  type: http\n  seq: ${sequence}\n}\n`;
}

/** The mocked `workspace.applyEdit` does not apply any edits, so the renames are applied here. */
async function applyRenames(edit: unknown) {
    for (const { from, to } of (
        edit as WorkspaceEdit & {
            renames: { from: { fsPath: string }; to: { fsPath: string } }[];
        }
    ).renames) {
        await rename(from.fsPath, to.fsPath);
    }
    return true;
}
