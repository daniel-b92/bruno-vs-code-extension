import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { workspace } from "vscode";
import {
    BrunoRequestFile,
    CollectionDirectory,
    CollectionFormat,
    getFolderSettingsFileName,
    getSequencePrefix,
} from "@global_shared";
import {
    createCollectionWithItems,
    createFolderItem,
    folderSettingsContent,
    getFolderSequences,
    requestContent,
    runRequestBlock,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { BrunoTreeItem, TypedCollectionItemProvider } from "@shared";
import {
    applyWorkspaceEdit,
    mockVsCodeSettings,
} from "../../../../_testingUtils";
import { FolderDropInsertionOption } from "../folderDropInsertionOptionEnum";
import { moveFolderIntoTargetFolder } from "./moveFolderIntoTargetFolder";

describe("moveFolderIntoTargetFolder", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("keeps the name of the moved folder in sync with its new sequence and updates the paths of requests within it", async () => {
        mockVsCodeSettings({
            "bru-as-code.prefixNamesWithSequence": true,
            "bru-as-code.sequenceStep": 10,
        });
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );
        const directory = await createTemporaryDirectory({
            "a/00010_users/folder.bru": folderSettingsContent(
                CollectionFormat.Bru,
                "users",
                10,
            ),
            "a/00010_users/00010_get.bru": requestContent(
                CollectionFormat.Bru,
                "get",
                10,
                runRequestBlock("a/00010_users/00020_other"),
            ),
            "a/00010_users/00020_other.bru": requestContent(
                CollectionFormat.Bru,
                "other",
                20,
            ),
            "b/00010_existing/folder.bru": folderSettingsContent(
                CollectionFormat.Bru,
                "existing",
                10,
            ),
        });
        const itemProvider =
            createCollectionWithItems<TypedCollectionItemProvider>(
                [
                    new CollectionDirectory(join(directory, "a")),
                    new CollectionDirectory(join(directory, "b")),
                    new CollectionDirectory(
                        join(directory, "a", "00010_users"),
                        join(directory, "a", "00010_users", "folder.bru"),
                        10,
                    ),
                    new BrunoRequestFile(
                        join(directory, "a", "00010_users", "00010_get.bru"),
                        10,
                    ),
                    new BrunoRequestFile(
                        join(directory, "a", "00010_users", "00020_other.bru"),
                        20,
                    ),
                    new CollectionDirectory(
                        join(directory, "b", "00010_existing"),
                        join(directory, "b", "00010_existing", "folder.bru"),
                        10,
                    ),
                ],
                CollectionFormat.Bru,
                [],
                directory,
            ).itemProvider;

        await moveFolderIntoTargetFolder(
            itemProvider,
            join(directory, "a", "00010_users"),
            new BrunoTreeItem(join(directory, "b"), false, false),
            FolderDropInsertionOption.MoveIntoTargetAsSubfolder,
            10,
        );

        expect(await readdir(join(directory, "a"))).toEqual([]);
        expect((await readdir(join(directory, "b"))).sort()).toEqual([
            "00010_existing",
            "00020_users",
        ]);
        expect(
            await readFile(
                join(directory, "b", "00020_users", "folder.bru"),
                "utf-8",
            ),
        ).toContain("seq: 20");
        // The request within the moved folder was found by its new location and refers to the final locations.
        expect(
            await readFile(
                join(directory, "b", "00020_users", "00010_get.bru"),
                "utf-8",
            ),
        ).toContain('runRequest("b/00020_users/00020_other")');
    });

    it("replaces an existing folder if overwriting is requested", async () => {
        mockVsCodeSettings({ "bru-as-code.sequenceStep": 10 });
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );
        const movedContent = requestContent(CollectionFormat.Bru, "moved", 10);
        const directory = await createTemporaryDirectory({
            "a/users/get.bru": movedContent,
            // The calls of the replaced folder must not cause edits of the moved one.
            "b/users/get.bru": requestContent(
                CollectionFormat.Bru,
                "replaced",
                10,
                runRequestBlock("a/users/get"),
            ),
            "b/users/other.bru": requestContent(
                CollectionFormat.Bru,
                "other",
                20,
            ),
        });
        const { itemProvider } =
            createCollectionWithItems<TypedCollectionItemProvider>(
                [
                    new CollectionDirectory(join(directory, "a")),
                    new CollectionDirectory(join(directory, "b")),
                    new CollectionDirectory(join(directory, "a", "users")),
                    new CollectionDirectory(join(directory, "b", "users")),
                    new BrunoRequestFile(
                        join(directory, "a", "users", "get.bru"),
                        10,
                    ),
                    new BrunoRequestFile(
                        join(directory, "b", "users", "get.bru"),
                        10,
                    ),
                    new BrunoRequestFile(
                        join(directory, "b", "users", "other.bru"),
                        20,
                    ),
                ],
                CollectionFormat.Bru,
                [],
                directory,
            );

        await moveFolderIntoTargetFolder(
            itemProvider,
            join(directory, "a", "users"),
            new BrunoTreeItem(join(directory, "b"), false, false),
            FolderDropInsertionOption.MoveIntoTargetAsSubfolder,
            undefined,
            undefined,
            true,
        );

        expect(await readdir(join(directory, "a"))).toEqual([]);
        expect(await readdir(join(directory, "b", "users"))).toEqual([
            "get.bru",
        ]);
        expect(
            await readFile(join(directory, "b", "users", "get.bru"), "utf-8"),
        ).toBe(movedContent);
    });

    describe.each([CollectionFormat.Bru, CollectionFormat.Yaml])(
        "when overwriting a folder (%s)",
        (format) => {
            it.each(
                [10, undefined].flatMap((movedSequence) =>
                    [false, true].map((renumber) => ({
                        movedSequence,
                        renumber,
                    })),
                ),
            )(
                "takes over the replaced sequence (moved sequence: $movedSequence, renumbering: $renumber)",
                async ({ movedSequence, renumber }) => {
                    const directory = await overwriteFolder({
                        format,
                        movedSequence,
                        renumber,
                    });

                    expect(await getFolderSequences(directory, format)).toEqual(
                        {
                            [join("b", "first")]: 10,
                            [join("b", "users")]: 20,
                            [join("b", "last")]: 30,
                        },
                    );
                },
            );

            it("adjusts the prefix to the taken over sequence", async () => {
                const directory = await overwriteFolder({
                    format,
                    movedSequence: 10,
                    prefixNames: true,
                });

                expect(await getFolderSequences(directory, format)).toEqual({
                    [join("b", "00010_first")]: 10,
                    [join("b", "00020_users")]: 20,
                    [join("b", "00030_last")]: 30,
                });
            });
        },
    );

    /** Moves `a/users` over `b/users` (with sequence 20), which is located between the folders `first` and `last`. */
    async function overwriteFolder({
        format,
        movedSequence,
        renumber = false,
        prefixNames = false,
    }: {
        format: CollectionFormat;
        movedSequence: number | undefined;
        renumber?: boolean;
        prefixNames?: boolean;
    }) {
        const settingsFile = getFolderSettingsFileName(format);
        mockVsCodeSettings({
            "bru-as-code.prefixNamesWithSequence": prefixNames,
            "bru-as-code.renumberSequencesAutomatically": renumber,
            "bru-as-code.sequenceStep": 10,
        });
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );
        // With prefixes, folders can only be overwritten if they have the same prefix, even if it is outdated.
        const name = (baseName: string, sequence: number) =>
            `${prefixNames ? getSequencePrefix(sequence) : ""}${baseName}`;
        const folders = [
            {
                path: join("a", name("users", 10)),
                sequence: movedSequence,
            },
            { path: join("b", name("users", 10)), sequence: 20 },
            { path: join("b", name("first", 10)), sequence: 10 },
            { path: join("b", name("last", 30)), sequence: 30 },
        ];
        const directory = await createTemporaryDirectory(
            Object.fromEntries(
                folders.map(({ path, sequence }) =>
                    // A folder without a sequence has no settings file.
                    sequence === undefined
                        ? [join(path, "script.js"), ""]
                        : [
                              join(path, settingsFile),
                              folderSettingsContent(format, "name", sequence),
                          ],
                ),
            ),
        );
        const { itemProvider } =
            createCollectionWithItems<TypedCollectionItemProvider>(
                [
                    new CollectionDirectory(join(directory, "a")),
                    new CollectionDirectory(join(directory, "b")),
                    ...folders.map(({ path, sequence }) =>
                        sequence === undefined
                            ? new CollectionDirectory(join(directory, path))
                            : createFolderItem(
                                  join(directory, path),
                                  format,
                                  sequence,
                              ),
                    ),
                ],
                format,
                [],
                directory,
            );

        await moveFolderIntoTargetFolder(
            itemProvider,
            join(directory, "a", name("users", 10)),
            new BrunoTreeItem(join(directory, "b"), false, false),
            FolderDropInsertionOption.MoveIntoTargetAsSubfolder,
            movedSequence,
            undefined,
            true,
        );

        return directory;
    }
});
