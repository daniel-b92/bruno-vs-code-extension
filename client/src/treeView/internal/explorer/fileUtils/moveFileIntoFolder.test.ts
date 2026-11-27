import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { workspace } from "vscode";
import {
    BrunoFileType,
    BrunoFolderSettingsFile,
    BrunoRequestFile,
    CollectionDirectory,
    CollectionFormat,
    getFolderSettingsFileName,
    NonBrunoFile,
    NonBrunoSpecificItemType,
} from "@global_shared";
import {
    createCollectionWithItems,
    folderSettingsContent,
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
});
