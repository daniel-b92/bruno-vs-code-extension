import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { join } from "path";
import { readdir, readFile, rename } from "fs/promises";
import { window, workspace, WorkspaceEdit } from "vscode";
import { BrunoRequestFile, CollectionFormat } from "@global_shared";
import {
    createCollectionWithItems,
    runRequestBlock,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "@shared";
import { applyWorkspaceEdit } from "../../../_testingUtils";
import {
    renameFileOrFolder,
    renameFilesAndFolders,
} from "./renameFileOrFolder";

const root = join("/", "collection");
const callerPath = join(root, "caller.bru");
const callerContent = `script:pre-request {
  await bru.runRequest("users/a");
}
`;

describe("renameFileOrFolder", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("renames the file together with the updates of run request paths and saves the edited files", async () => {
        const applyEdit = jest.spyOn(workspace, "applyEdit");
        const save = jest.spyOn(workspace, "save");
        openDocuments(openDocument(callerPath, callerContent, false));

        const result = await renameFileOrFolder(
            createItemProvider(),
            join(root, "users/a.bru"),
            join(root, "users/b.bru"),
            true,
        );

        expect(result).toBe(true);
        expect(applyEdit).toHaveBeenCalledTimes(1);
        const [edit, metadata] = applyEdit.mock.calls[0];
        expect(metadata).toEqual({ isRefactoring: true });
        expect(
            (
                edit as WorkspaceEdit & {
                    renames: { to: { fsPath: string } }[];
                }
            ).renames.map(({ to }) => to.fsPath),
        ).toEqual([join(root, "users/b.bru")]);
        expect(
            (
                edit as WorkspaceEdit & {
                    replacements: {
                        uri: { fsPath: string };
                        newText: string;
                    }[];
                }
            ).replacements.map(({ uri, newText }) => [uri.fsPath, newText]),
        ).toEqual([[callerPath, "users/b"]]);
        expect(save).toHaveBeenCalledTimes(1);
        expect(save.mock.calls[0][0]).toMatchObject({ fsPath: callerPath });
    });

    it("replaces an existing item at the target path only when requested", async () => {
        const applyEdit = jest.spyOn(workspace, "applyEdit");
        const itemProvider = createItemProvider();

        await renameFileOrFolder(
            itemProvider,
            join(root, "users/a.bru"),
            join(root, "users/b.bru"),
            true,
        );
        await renameFileOrFolder(
            itemProvider,
            join(root, "users/a.bru"),
            join(root, "users/b.bru"),
            true,
            undefined,
            true,
        );

        const [withoutOverwrite, withOverwrite] = applyEdit.mock.calls.map(
            ([edit]) =>
                (
                    edit as WorkspaceEdit & {
                        renames: { options?: { overwrite?: boolean } }[];
                    }
                ).renames[0].options,
        );
        expect(withoutOverwrite).toBeUndefined();
        expect(withOverwrite).toEqual({ overwrite: true });
    });

    it("does not save documents that had unsaved changes", async () => {
        const save = jest.spyOn(workspace, "save");
        openDocuments(openDocument(callerPath, callerContent, true));

        await renameFileOrFolder(
            createItemProvider(),
            join(root, "users/a.bru"),
            join(root, "users/b.bru"),
            true,
        );

        expect(save).not.toHaveBeenCalled();
    });

    it("renames items within a folder in an earlier workspace edit than the folder, with updates for the final locations", async () => {
        const applyEdit = jest.spyOn(workspace, "applyEdit");
        openDocuments(openDocument(callerPath, callerContent, false));

        const result = await renameFilesAndFolders(createItemProvider(), [
            {
                sourcePath: join(root, "users/a.bru"),
                targetPath: join(root, "users/0010_a.bru"),
                isFile: true,
            },
            {
                sourcePath: join(root, "users"),
                targetPath: join(root, "0020_users"),
                isFile: false,
            },
        ]);

        expect(result).toBe(true);
        const edits = applyEdit.mock.calls.map(
            ([edit]) =>
                edit as WorkspaceEdit & {
                    renames: { from: { fsPath: string } }[];
                    replacements: { newText: string }[];
                },
        );
        expect(
            edits.map(({ renames }) => renames.map(({ from }) => from.fsPath)),
        ).toEqual([[join(root, "users/a.bru")], [join(root, "users")]]);
        expect(
            edits.map(({ replacements }) =>
                replacements.map(({ newText }) => newText),
            ),
        ).toEqual([[], ["0020_users/0010_a"]]);
    });

    it("does nothing when an item is renamed to its own path", async () => {
        const applyEdit = jest.spyOn(workspace, "applyEdit");
        const showErrorMessage = jest.spyOn(window, "showErrorMessage");

        const result = await renameFileOrFolder(
            createItemProvider(),
            join(root, "users/a.bru"),
            join(root, "users/a.bru"),
            true,
        );

        expect(result).toBe(true);
        expect(applyEdit).not.toHaveBeenCalled();
        expect(showErrorMessage).not.toHaveBeenCalled();
    });

    it("ignores renames to the own path when renaming several items", async () => {
        const applyEdit = jest.spyOn(workspace, "applyEdit");

        await renameFilesAndFolders(createItemProvider(), [
            {
                sourcePath: join(root, "users/a.bru"),
                targetPath: join(root, "users/a.bru"),
                isFile: true,
            },
            {
                sourcePath: join(root, "users/b.bru"),
                targetPath: join(root, "users/c.bru"),
                isFile: true,
            },
        ]);

        expect(
            (
                applyEdit.mock.calls[0][0] as WorkspaceEdit & {
                    renames: { from: { fsPath: string } }[];
                }
            ).renames.map(({ from }) => from.fsPath),
        ).toEqual([join(root, "users/b.bru")]);
    });

    it("shifts the names of items with the same base name, using one workspace edit per dependent step", async () => {
        const applyEdit = jest
            .spyOn(workspace, "applyEdit")
            .mockImplementation(applyWorkspaceEdit);
        const directory = await createTemporaryDirectory({
            "001_login.bru": "first",
            "002_login.bru": "second",
        });

        const result = await renameFilesAndFolders(
            createItemProviderFor(directory),
            [
                {
                    sourcePath: join(directory, "001_login.bru"),
                    targetPath: join(directory, "002_login.bru"),
                    isFile: true,
                },
                {
                    sourcePath: join(directory, "002_login.bru"),
                    targetPath: join(directory, "003_login.bru"),
                    isFile: true,
                },
            ],
        );

        expect(result).toBe(true);
        expect(applyEdit).toHaveBeenCalledTimes(2);
        expect(await readdir(directory)).toEqual([
            "002_login.bru",
            "003_login.bru",
        ]);
        expect(await readFile(join(directory, "002_login.bru"), "utf-8")).toBe(
            "first",
        );
        expect(await readFile(join(directory, "003_login.bru"), "utf-8")).toBe(
            "second",
        );
    });

    it("swaps the names of two items", async () => {
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );
        const directory = await createTemporaryDirectory({
            "001_login.bru": "first",
            "002_login.bru": "second",
        });

        const result = await renameFilesAndFolders(
            createItemProviderFor(directory),
            [
                {
                    sourcePath: join(directory, "001_login.bru"),
                    targetPath: join(directory, "002_login.bru"),
                    isFile: true,
                },
                {
                    sourcePath: join(directory, "002_login.bru"),
                    targetPath: join(directory, "001_login.bru"),
                    isFile: true,
                },
            ],
        );

        expect(result).toBe(true);
        expect(await readFile(join(directory, "001_login.bru"), "utf-8")).toBe(
            "second",
        );
        expect(await readFile(join(directory, "002_login.bru"), "utf-8")).toBe(
            "first",
        );
    });

    it("applies the updates of run request paths with the last workspace edit only", async () => {
        const applyEdit = jest.spyOn(workspace, "applyEdit");
        openDocuments(openDocument(callerPath, callerContent, false));

        await renameFilesAndFolders(createItemProvider(), [
            {
                sourcePath: join(root, "users/a.bru"),
                targetPath: join(root, "users/b.bru"),
                isFile: true,
            },
            {
                sourcePath: join(root, "users/c.bru"),
                targetPath: join(root, "users/a.bru"),
                isFile: true,
            },
        ]);

        expect(applyEdit).toHaveBeenCalledTimes(2);
        const [first, second] = applyEdit.mock.calls.map(
            ([edit]) =>
                (edit as WorkspaceEdit & { replacements: unknown[] })
                    .replacements,
        );
        expect(first).toEqual([]);
        expect(second).toHaveLength(1);
    });

    it("does nothing if there is nothing to rename", async () => {
        const applyEdit = jest.spyOn(workspace, "applyEdit");

        expect(await renameFilesAndFolders(createItemProvider(), [])).toBe(
            true,
        );
        expect(applyEdit).not.toHaveBeenCalled();
    });

    it("renames without updates if the rename with updates fails", async () => {
        openDocuments(openDocument(callerPath, callerContent, false));
        const applyEdit = jest
            .spyOn(workspace, "applyEdit")
            .mockResolvedValueOnce(false);

        const result = await renameFileOrFolder(
            createItemProvider(),
            join(root, "users/a.bru"),
            join(root, "users/b.bru"),
            true,
        );

        expect(result).toBe(true);
        expect(applyEdit).toHaveBeenCalledTimes(2);
        expect(
            (applyEdit.mock.calls[1][0] as WorkspaceEdit & { replacements: [] })
                .replacements,
        ).toEqual([]);
    });

    it("only executes the remaining renames if updating the paths fails after items were renamed", async () => {
        const directory = await createTemporaryDirectory({
            "a.bru": "",
            "caller.bru": runRequestBlock("a"),
        });
        const applyEdit = jest
            .spyOn(workspace, "applyEdit")
            .mockImplementationOnce(async (edit) => {
                await applyWorkspaceEdit(withoutReplacements(edit));
                return false;
            });

        const result = await renameFileOrFolder(
            createItemProviderFor(directory, ["a.bru", "caller.bru"]),
            join(directory, "a.bru"),
            join(directory, "b.bru"),
            true,
        );

        expect(result).toBe(true);
        expect(applyEdit).toHaveBeenCalledTimes(1);
        expect(await readdir(directory)).toEqual(["b.bru", "caller.bru"]);
    });

    it("does not move an unrelated item at the target if the source was missing before", async () => {
        const directory = await createTemporaryDirectory({
            "00001_b.bru": "unrelated",
        });
        jest.spyOn(window, "showErrorMessage").mockResolvedValue(undefined);
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );

        const result = await renameFileOrFolder(
            createItemProviderFor(directory),
            join(directory, "00002_b.bru"),
            join(directory, "00001_b.bru"),
            true,
        );

        expect(result).toBe(false);
        expect(await readdir(directory)).toEqual(["00001_b.bru"]);
        expect(await readFile(join(directory, "00001_b.bru"), "utf-8")).toBe(
            "unrelated",
        );
    });

    it("does not count the rename as successful if the source was missing before and updating the paths fails", async () => {
        const directory = await createTemporaryDirectory({
            "00001_b.bru": "unrelated",
            "caller.bru": runRequestBlock("00002_b"),
        });
        jest.spyOn(window, "showErrorMessage").mockResolvedValue(undefined);
        const applyEdit = jest
            .spyOn(workspace, "applyEdit")
            .mockImplementation(applyWorkspaceEdit);

        const result = await renameFileOrFolder(
            createItemProviderFor(directory, ["00002_b.bru", "caller.bru"]),
            join(directory, "00002_b.bru"),
            join(directory, "00001_b.bru"),
            true,
        );

        expect(result).toBe(false);
        expect(applyEdit).toHaveBeenCalledTimes(2);
        expect(await readdir(directory)).toEqual(["00001_b.bru", "caller.bru"]);
    });

    describe("if one of several workspace edits fails", () => {
        const swap = (directory: string) => [
            {
                sourcePath: join(directory, "001_login.bru"),
                targetPath: join(directory, "002_login.bru"),
                isFile: true,
            },
            {
                sourcePath: join(directory, "002_login.bru"),
                targetPath: join(directory, "001_login.bru"),
                isFile: true,
            },
        ];

        it("rolls back the renames that were already executed", async () => {
            const directory = await createTemporaryDirectory({
                "001_login.bru": "first",
                "002_login.bru": "second",
            });
            const showErrorMessage = jest
                .spyOn(window, "showErrorMessage")
                .mockResolvedValue(undefined);
            failOnEdits([3]);

            const result = await renameFilesAndFolders(
                createItemProviderFor(directory),
                swap(directory),
            );

            expect(result).toBe(false);
            expect(await readdir(directory)).toEqual([
                "001_login.bru",
                "002_login.bru",
            ]);
            expect(
                await readFile(join(directory, "001_login.bru"), "utf-8"),
            ).toBe("first");
            expect(showErrorMessage.mock.calls).toEqual([
                ["Renaming / Moving 2 items failed unexpectedly."],
            ]);
        });

        it("rolls back nested items and their folder", async () => {
            const directory = await createTemporaryDirectory({
                "users/a.bru": "",
                "c.bru": "",
                "d.bru": "",
            });
            jest.spyOn(window, "showErrorMessage").mockResolvedValue(undefined);
            // The target of the last rename is taken.
            jest.spyOn(workspace, "applyEdit").mockImplementation(
                applyWorkspaceEdit,
            );

            const result = await renameFilesAndFolders(
                createItemProviderFor(directory),
                [
                    {
                        sourcePath: join(directory, "users", "a.bru"),
                        targetPath: join(directory, "users", "b.bru"),
                        isFile: true,
                    },
                    {
                        sourcePath: join(directory, "users"),
                        targetPath: join(directory, "0020_users"),
                        isFile: false,
                    },
                    {
                        sourcePath: join(directory, "c.bru"),
                        targetPath: join(directory, "d.bru"),
                        isFile: true,
                    },
                ],
            );

            expect(result).toBe(false);
            expect(await readdir(directory)).toEqual([
                "c.bru",
                "d.bru",
                "users",
            ]);
            expect(await readdir(join(directory, "users"))).toEqual(["a.bru"]);
        });

        it("rolls back renames of the failed edit that were executed", async () => {
            const directory = await createTemporaryDirectory({
                "a.bru": "",
                "c.bru": "",
            });
            jest.spyOn(window, "showErrorMessage").mockResolvedValue(undefined);
            jest.spyOn(workspace, "applyEdit")
                .mockImplementationOnce(async () => {
                    await rename(
                        join(directory, "a.bru"),
                        join(directory, "b.bru"),
                    );
                    return false;
                })
                .mockImplementation(applyWorkspaceEdit);

            const result = await renameFilesAndFolders(
                createItemProviderFor(directory),
                [
                    {
                        sourcePath: join(directory, "a.bru"),
                        targetPath: join(directory, "b.bru"),
                        isFile: true,
                    },
                    {
                        sourcePath: join(directory, "c.bru"),
                        targetPath: join(directory, "d.bru"),
                        isFile: true,
                    },
                ],
            );

            expect(result).toBe(false);
            expect(await readdir(directory)).toEqual(["a.bru", "c.bru"]);
        });

        it("informs the user if rolling back fails as well", async () => {
            const directory = await createTemporaryDirectory({
                "001_login.bru": "first",
                "002_login.bru": "second",
            });
            const showErrorMessage = jest
                .spyOn(window, "showErrorMessage")
                .mockResolvedValue(undefined);
            failOnEdits([3, 4]);

            const result = await renameFilesAndFolders(
                createItemProviderFor(directory),
                swap(directory),
            );

            expect(result).toBe(false);
            expect(showErrorMessage.mock.calls[0][0]).toContain(
                "could not be renamed back",
            );
        });
    });
});

function createItemProvider() {
    return createCollectionWithItems<TypedCollectionItemProvider>(
        [
            new BrunoRequestFile(join(root, "users/a.bru")),
            new BrunoRequestFile(callerPath),
        ],
        CollectionFormat.Bru,
        [],
        root,
    ).itemProvider;
}

/** All edits are applied, except for the ones with the given numbers (starting at 1). */
function failOnEdits(failingEdits: number[]) {
    let count = 0;

    jest.spyOn(workspace, "applyEdit").mockImplementation(async (edit) => {
        count++;
        return (
            !failingEdits.includes(count) && (await applyWorkspaceEdit(edit))
        );
    });
}

function withoutReplacements(edit: WorkspaceEdit) {
    return { ...edit, replacements: [] };
}

function createItemProviderFor(
    directory: string,
    requestFileNames: string[] = [],
) {
    return createCollectionWithItems<TypedCollectionItemProvider>(
        requestFileNames.map(
            (name) => new BrunoRequestFile(join(directory, name)),
        ),
        CollectionFormat.Bru,
        [],
        directory,
    ).itemProvider;
}

function openDocument(path: string, content: string, isDirty: boolean) {
    return {
        fileName: path,
        eol: 1,
        uri: { fsPath: path },
        isDirty,
        getText: () => content,
    };
}

function openDocuments(...documents: ReturnType<typeof openDocument>[]) {
    jest.replaceProperty(workspace, "textDocuments", documents as never);
}
