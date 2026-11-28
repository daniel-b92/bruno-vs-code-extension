import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { workspace } from "vscode";
import {
    BrunoAppFile,
    BrunoFileType,
    BrunoFolderSettingsFile,
    BrunoRequestFile,
    CollectionDirectory,
    CollectionFormat,
    getFileExtensionForFormat,
    getFolderSettingsFileName,
    getSequencePrefix,
    NonBrunoFile,
    NonBrunoSpecificItemType,
} from "@global_shared";
import {
    createCollectionWithItems,
    folderSettingsContent,
    getRequestSequences,
    requestContent,
    runRequestBlock,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { BrunoTreeItem, TypedCollectionItemProvider } from "@shared";
import {
    applyWorkspaceEdit,
    mockVsCodeSettings,
} from "../../../../_testingUtils";
import { moveFileIntoFolder } from "./moveFileIntoFolder";

describe("moveFileIntoFolder", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it.each([
        [true, ["00010_y.bru", "00020_x.bru"], "b/00020_x"],
        [false, ["00010_x.bru", "00010_y.bru"], "b/00010_x"],
    ])(
        "keeps the name in sync with the new sequence of the moved request if names are prefixed with sequences (%s)",
        async (prefixNames, expectedNames, expectedCall) => {
            mockVsCodeSettings({
                "bru-as-code.prefixNamesWithSequence": prefixNames,
                "bru-as-code.sequenceStep": 10,
            });
            jest.spyOn(workspace, "applyEdit").mockImplementation(
                applyWorkspaceEdit,
            );
            const directory = await createTemporaryDirectory({
                "caller.bru": requestContent(
                    CollectionFormat.Bru,
                    "caller",
                    undefined,
                    runRequestBlock("a/00010_x"),
                ),
                "a/00010_x.bru": requestContent(CollectionFormat.Bru, "x", 10),
                "b/00010_y.bru": requestContent(CollectionFormat.Bru, "y", 10),
            });
            const itemProvider =
                createCollectionWithItems<TypedCollectionItemProvider>(
                    [
                        new BrunoRequestFile(join(directory, "caller.bru")),
                        new CollectionDirectory(join(directory, "a")),
                        new CollectionDirectory(join(directory, "b")),
                        new BrunoRequestFile(
                            join(directory, "a", "00010_x.bru"),
                            10,
                        ),
                        new BrunoRequestFile(
                            join(directory, "b", "00010_y.bru"),
                            10,
                        ),
                    ],
                    CollectionFormat.Bru,
                    [],
                    directory,
                ).itemProvider;

            await moveFileIntoFolder(
                itemProvider,
                join(directory, "a", "00010_x.bru"),
                join(directory, "b", "00010_x.bru"),
                new BrunoTreeItem(join(directory, "b"), false, false),
                join(directory, "b"),
                BrunoFileType.RequestFile,
            );

            expect(await readdir(join(directory, "a"))).toEqual([]);
            expect((await readdir(join(directory, "b"))).sort()).toEqual(
                expectedNames,
            );
            // The path in the call refers to the final location of the request.
            expect(
                await readFile(join(directory, "caller.bru"), "utf-8"),
            ).toContain(`runRequest("${expectedCall}")`);
        },
    );

    it("replaces an existing file if overwriting is requested", async () => {
        mockVsCodeSettings({ "bru-as-code.sequenceStep": 10 });
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );
        const movedContent = requestContent(CollectionFormat.Bru, "moved", 10);
        const directory = await createTemporaryDirectory({
            "a/x.bru": movedContent,
            // The calls of the replaced file must not cause edits of the moved one.
            "b/x.bru": requestContent(
                CollectionFormat.Bru,
                "replaced",
                10,
                runRequestBlock("a/x"),
            ),
        });
        const sourcePath = join(directory, "a", "x.bru");
        const newPath = join(directory, "b", "x.bru");
        const { itemProvider } =
            createCollectionWithItems<TypedCollectionItemProvider>(
                [
                    new CollectionDirectory(join(directory, "a")),
                    new CollectionDirectory(join(directory, "b")),
                    new BrunoRequestFile(sourcePath, 10),
                    new BrunoRequestFile(newPath, 10),
                ],
                CollectionFormat.Bru,
                [],
                directory,
            );

        await moveFileIntoFolder(
            itemProvider,
            sourcePath,
            newPath,
            new BrunoTreeItem(join(directory, "b"), false, false),
            join(directory, "b"),
            BrunoFileType.RequestFile,
            undefined,
            true,
        );

        expect(await readdir(join(directory, "a"))).toEqual([]);
        expect(await readdir(join(directory, "b"))).toEqual(["x.bru"]);
        expect(await readFile(newPath, "utf-8")).toBe(movedContent);
    });

    describe.each([CollectionFormat.Bru, CollectionFormat.Yaml])(
        "when overwriting a file (%s)",
        (format) => {
            const extension = getFileExtensionForFormat(format);

            const cases = [
                BrunoFileType.RequestFile,
                BrunoFileType.AppFile,
            ].flatMap((fileType) =>
                [10, undefined].flatMap((movedSequence) =>
                    [false, true].map((renumber) => ({
                        fileType,
                        movedSequence,
                        renumber,
                    })),
                ),
            );

            it.each(cases)(
                "takes over the replaced sequence when dropped on the replaced file ($fileType with sequence $movedSequence, renumbering: $renumber)",
                async ({ fileType, movedSequence, renumber }) => {
                    const { targetFolder } = await overwriteFile({
                        format,
                        fileType,
                        movedSequence,
                        replacedSequence: 20,
                        renumber,
                        droppedOn: "replaced file",
                    });

                    expect(await getRequestSequences(targetFolder)).toEqual({
                        [`first${extension}`]: 10,
                        [`x${extension}`]: 20,
                        [`last${extension}`]: 30,
                    });
                },
            );

            it.each(
                (["folder", "last file"] as const).flatMap((droppedOn) =>
                    cases.map((testCase) => ({ ...testCase, droppedOn })),
                ),
            )(
                "moves the file to the end when dropped on the $droppedOn ($fileType with sequence $movedSequence, renumbering: $renumber)",
                async ({ fileType, movedSequence, renumber, droppedOn }) => {
                    const { targetFolder } = await overwriteFile({
                        format,
                        fileType,
                        movedSequence,
                        replacedSequence: 20,
                        renumber,
                        droppedOn,
                    });

                    expect(await getRequestSequences(targetFolder)).toEqual({
                        [`first${extension}`]: 10,
                        [`last${extension}`]: renumber ? 20 : 30,
                        [`x${extension}`]: renumber ? 30 : 40,
                    });
                },
            );

            it("appends the moved request if the replaced one has no sequence", async () => {
                const { targetFolder } = await overwriteFile({
                    format,
                    movedSequence: 5,
                    replacedSequence: undefined,
                });

                expect(await getRequestSequences(targetFolder)).toEqual({
                    [`first${extension}`]: 10,
                    [`x${extension}`]: 40,
                    [`last${extension}`]: 30,
                });
            });

            it("adjusts the prefix to the taken over sequence", async () => {
                const { targetFolder } = await overwriteFile({
                    format,
                    movedSequence: 10,
                    replacedSequence: 20,
                    prefixNames: true,
                    droppedOn: "replaced file",
                });

                expect(await getRequestSequences(targetFolder)).toEqual({
                    [`00010_first${extension}`]: 10,
                    [`00020_x${extension}`]: 20,
                    [`00030_last${extension}`]: 30,
                });
            });
        },
    );

    it("does not rename requests when moving a file of another type", async () => {
        mockVsCodeSettings({
            "bru-as-code.prefixNamesWithSequence": true,
            "bru-as-code.sequenceStep": 10,
        });
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );
        const directory = await createTemporaryDirectory({
            "a/script.js": "",
            "a/x.bru": requestContent(CollectionFormat.Bru, "x", 10),
            "b/00020_y.bru": requestContent(CollectionFormat.Bru, "y", 10),
        });
        const { itemProvider } =
            createCollectionWithItems<TypedCollectionItemProvider>(
                [
                    new CollectionDirectory(join(directory, "a")),
                    new CollectionDirectory(join(directory, "b")),
                    new NonBrunoFile(join(directory, "a", "script.js")),
                    new BrunoRequestFile(join(directory, "a", "x.bru"), 10),
                    new BrunoRequestFile(
                        join(directory, "b", "00020_y.bru"),
                        10,
                    ),
                ],
                CollectionFormat.Bru,
                [],
                directory,
            );

        await moveFileIntoFolder(
            itemProvider,
            join(directory, "a", "script.js"),
            join(directory, "b", "script.js"),
            new BrunoTreeItem(join(directory, "b"), false, false),
            join(directory, "b"),
            NonBrunoSpecificItemType.OtherFileType,
        );

        expect(await readdir(join(directory, "a"))).toEqual(["x.bru"]);
        expect((await readdir(join(directory, "b"))).sort()).toEqual([
            "00020_y.bru",
            "script.js",
        ]);
    });

    it.each([CollectionFormat.Bru, CollectionFormat.Yaml])(
        "renames the target folder when moving a folder settings file (%s)",
        async (format) => {
            mockVsCodeSettings({
                "bru-as-code.prefixNamesWithSequence": true,
                "bru-as-code.sequenceStep": 10,
            });
            jest.spyOn(workspace, "applyEdit").mockImplementation(
                applyWorkspaceEdit,
            );
            const settingsFile = getFolderSettingsFileName(format);
            const directory = await createTemporaryDirectory({
                [`a/${settingsFile}`]: folderSettingsContent(format, "a", 10),
                "b/script.js": "",
            });
            const sourcePath = join(directory, "a", settingsFile);
            const targetFolder = join(directory, "b");
            const { itemProvider } =
                createCollectionWithItems<TypedCollectionItemProvider>(
                    [
                        new CollectionDirectory(join(directory, "a")),
                        new CollectionDirectory(join(directory, "b")),
                        new BrunoFolderSettingsFile(sourcePath),
                    ],
                    format,
                    [],
                    directory,
                );

            await moveFileIntoFolder(
                itemProvider,
                sourcePath,
                join(targetFolder, settingsFile),
                new BrunoTreeItem(targetFolder, false, false),
                targetFolder,
                BrunoFileType.FolderSettingsFile,
            );

            expect((await readdir(directory)).sort()).toEqual(["00010_b", "a"]);
            expect((await readdir(join(directory, "00010_b"))).sort()).toEqual([
                settingsFile,
                "script.js",
            ]);
        },
    );

    it.each([CollectionFormat.Bru, CollectionFormat.Yaml])(
        "does not rename folders when moving a folder settings file into the collection root (%s)",
        async (format) => {
            mockVsCodeSettings({
                "bru-as-code.prefixNamesWithSequence": true,
                "bru-as-code.sequenceStep": 10,
            });
            jest.spyOn(workspace, "applyEdit").mockImplementation(
                applyWorkspaceEdit,
            );
            const settingsFile = getFolderSettingsFileName(format);
            const directory = await createTemporaryDirectory({
                [`a/${settingsFile}`]: folderSettingsContent(format, "a", 10),
                "b/script.js": "",
            });
            const sourcePath = join(directory, "a", settingsFile);
            const targetFolder = directory;
            const { itemProvider } =
                createCollectionWithItems<TypedCollectionItemProvider>(
                    [
                        new CollectionDirectory(join(directory, "a")),
                        new CollectionDirectory(join(directory, "b")),
                        new BrunoFolderSettingsFile(sourcePath),
                    ],
                    format,
                    [],
                    directory,
                );

            await moveFileIntoFolder(
                itemProvider,
                sourcePath,
                join(targetFolder, settingsFile),
                new BrunoTreeItem(targetFolder, false, false),
                targetFolder,
                BrunoFileType.FolderSettingsFile,
            );

            expect((await readdir(directory)).sort()).toEqual(
                ["a", "b", settingsFile].sort(),
            );
        },
    );

    /** Moves `a/x` over `b/x`, which is located between the files `first` and `last`. */
    async function overwriteFile({
        format,
        fileType = BrunoFileType.RequestFile,
        movedSequence,
        replacedSequence,
        renumber = false,
        droppedOn = "folder",
        prefixNames = false,
    }: {
        format: CollectionFormat;
        fileType?: BrunoFileType;
        movedSequence: number | undefined;
        replacedSequence: number | undefined;
        renumber?: boolean;
        droppedOn?: "folder" | "replaced file" | "last file";
        prefixNames?: boolean;
    }) {
        const extension = getFileExtensionForFormat(format);
        mockVsCodeSettings({
            "bru-as-code.prefixNamesWithSequence": prefixNames,
            "bru-as-code.renumberSequencesAutomatically": renumber,
            "bru-as-code.sequenceStep": 10,
        });
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );
        // With prefixes, files can only be overwritten if they have the same prefix, even if it is outdated.
        const name = (baseName: string, sequence: number) =>
            `${prefixNames ? getSequencePrefix(sequence) : ""}${baseName}${extension}`;
        const files = [
            { path: join("a", name("x", 10)), sequence: movedSequence },
            {
                path: join("b", name("x", 10)),
                sequence: replacedSequence,
            },
            { path: join("b", name("first", 10)), sequence: 10 },
            { path: join("b", name("last", 30)), sequence: 30 },
        ];
        const directory = await createTemporaryDirectory(
            Object.fromEntries(
                files.map(({ path, sequence }) => [
                    path,
                    requestContent(format, "name", sequence),
                ]),
            ),
        );
        const targetFolder = join(directory, "b");
        const newPath = join(targetFolder, name("x", 10));
        const dropTargets = {
            folder: new BrunoTreeItem(targetFolder, false, false),
            "replaced file": new BrunoTreeItem(
                newPath,
                true,
                false,
                replacedSequence,
            ),
            "last file": new BrunoTreeItem(
                join(targetFolder, name("last", 30)),
                true,
                false,
                30,
            ),
        };
        const { itemProvider } =
            createCollectionWithItems<TypedCollectionItemProvider>(
                [
                    new CollectionDirectory(join(directory, "a")),
                    new CollectionDirectory(targetFolder),
                    ...files.map(({ path, sequence }) =>
                        fileType == BrunoFileType.AppFile
                            ? new BrunoAppFile(join(directory, path), sequence)
                            : new BrunoRequestFile(
                                  join(directory, path),
                                  sequence,
                              ),
                    ),
                ],
                format,
                [],
                directory,
            );

        await moveFileIntoFolder(
            itemProvider,
            join(directory, "a", name("x", 10)),
            newPath,
            dropTargets[droppedOn],
            targetFolder,
            fileType,
            undefined,
            true,
        );

        return { targetFolder };
    }
});
