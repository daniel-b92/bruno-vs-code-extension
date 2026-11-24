import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { readdir } from "fs/promises";
import { join } from "path";
import { window, workspace } from "vscode";
import {
    BrunoRequestFile,
    CollectionDirectory,
    CollectionFormat,
    NonBrunoFile,
    checkIfPathExistsAsync,
} from "@global_shared";
import {
    createCollectionWithItems,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "@shared";
import { applyWorkspaceEdit } from "../../../../_testingUtils";
import { removeSequencePrefixesRecursively } from "./removeSequencePrefixesRecursively";

describe("removeSequencePrefixesRecursively", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("removes the prefixes below the selected folder, but keeps the folder itself", async () => {
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );
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

        const result = await removeSequencePrefixesRecursively(
            itemProvider,
            collection,
            join(directory, "020_users"),
        );

        expect(result).toEqual({
            renamedCount: 3,
            skippedCount: 0,
            failed: false,
        });
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
            .mockImplementation(applyWorkspaceEdit);
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

        const result = await removeSequencePrefixesRecursively(
            itemProvider,
            collection,
            directory,
        );

        expect(result).toEqual({
            renamedCount: 0,
            skippedCount: 1,
            failed: false,
        });
        expect(applyEdit).not.toHaveBeenCalled();
    });

    it("removes the prefixes of items without a sequence, but not of other items", async () => {
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );
        const directory = await createTemporaryDirectory({
            "010_a.bru": "meta {\n  name: a\n  type: http\n}\n",
            "020_with-settings/folder.bru": "meta {\n  name: x\n}\n",
            "2024_without-settings/b.bru": "x",
            "2024_report.json": "{}",
        });
        const { collection, itemProvider } =
            createCollectionWithItems<TypedCollectionItemProvider>(
                [
                    new BrunoRequestFile(join(directory, "010_a.bru")),
                    new CollectionDirectory(
                        join(directory, "020_with-settings"),
                        join(directory, "020_with-settings", "folder.bru"),
                    ),
                    new CollectionDirectory(
                        join(directory, "2024_without-settings"),
                    ),
                    new NonBrunoFile(join(directory, "2024_report.json")),
                ],
                CollectionFormat.Bru,
                [],
                directory,
            );

        const result = await removeSequencePrefixesRecursively(
            itemProvider,
            collection,
            directory,
        );

        expect(result.renamedCount).toBe(2);
        expect((await readdir(directory)).sort()).toEqual([
            "2024_report.json",
            "2024_without-settings",
            "a.bru",
            "with-settings",
        ]);
    });

    it("keeps digits that are part of the stored name, also when removing the prefixes again", async () => {
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );
        const directory = await createTemporaryDirectory({
            "005_404_error.bru":
                "meta {\n  name: 404_error\n  type: http\n  seq: 5\n}\n",
        });

        for (const name of ["005_404_error.bru", "404_error.bru"]) {
            const { collection, itemProvider } =
                createCollectionWithItems<TypedCollectionItemProvider>(
                    [new BrunoRequestFile(join(directory, name), 5)],
                    CollectionFormat.Bru,
                    [],
                    directory,
                );

            await removeSequencePrefixesRecursively(
                itemProvider,
                collection,
                directory,
            );

            expect(await readdir(directory)).toEqual(["404_error.bru"]);
        }
    });

    it("reports the items that are not renamed because the name is taken", async () => {
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );
        const directory = await createTemporaryDirectory({
            "010_a.bru": requestContent(10),
            "020_a.bru": requestContent(20),
            "030_b.bru": requestContent(30),
        });
        const { collection, itemProvider } =
            createCollectionWithItems<TypedCollectionItemProvider>(
                [
                    new BrunoRequestFile(join(directory, "010_a.bru"), 10),
                    new BrunoRequestFile(join(directory, "020_a.bru"), 20),
                    new BrunoRequestFile(join(directory, "030_b.bru"), 30),
                ],
                CollectionFormat.Bru,
                [],
                directory,
            );

        const result = await removeSequencePrefixesRecursively(
            itemProvider,
            collection,
            directory,
        );

        expect(result).toEqual({
            renamedCount: 2,
            skippedCount: 1,
            failed: false,
        });
        expect((await readdir(directory)).sort()).toEqual([
            "020_a.bru",
            "a.bru",
            "b.bru",
        ]);
    });

    it("reports a failure of renaming the items", async () => {
        jest.spyOn(workspace, "applyEdit").mockResolvedValue(false);
        jest.spyOn(window, "showErrorMessage").mockResolvedValue(undefined);
        const directory = await createTemporaryDirectory({
            "010_a.bru": requestContent(10),
        });
        const { collection, itemProvider } =
            createCollectionWithItems<TypedCollectionItemProvider>(
                [new BrunoRequestFile(join(directory, "010_a.bru"), 10)],
                CollectionFormat.Bru,
                [],
                directory,
            );

        expect(
            await removeSequencePrefixesRecursively(
                itemProvider,
                collection,
                directory,
            ),
        ).toEqual({ renamedCount: 0, skippedCount: 0, failed: true });
    });

    it("removes the prefixes in a yaml collection", async () => {
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );
        const directory = await createTemporaryDirectory({
            "0010_users/folder.yml":
                "info:\n  name: users\n  type: folder\n  seq: 10\n",
            "0010_users/0020_a.yml": yamlRequestContent(20),
        });
        const { collection, itemProvider } =
            createCollectionWithItems<TypedCollectionItemProvider>(
                [
                    new CollectionDirectory(
                        join(directory, "0010_users"),
                        join(directory, "0010_users", "folder.yml"),
                        10,
                    ),
                    new BrunoRequestFile(
                        join(directory, "0010_users", "0020_a.yml"),
                        20,
                    ),
                ],
                CollectionFormat.Yaml,
                [],
                directory,
            );

        const result = await removeSequencePrefixesRecursively(
            itemProvider,
            collection,
            directory,
        );

        expect(result.renamedCount).toBe(2);
        expect(await readdir(join(directory, "users"))).toEqual([
            "a.yml",
            "folder.yml",
        ]);
    });
});

function requestContent(sequence: number) {
    return `meta {\n  name: request\n  type: http\n  seq: ${sequence}\n}\n`;
}

function yamlRequestContent(sequence: number) {
    return `info:\n  name: request\n  type: http\n  seq: ${sequence}\nhttp:\n  method: GET\n  url: ""\n`;
}
