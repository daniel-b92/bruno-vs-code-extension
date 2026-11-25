import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { workspace } from "vscode";
import {
    BrunoFileType,
    BrunoRequestFile,
    CollectionDirectory,
    CollectionFormat,
    NonBrunoFile,
    NonBrunoSpecificItemType,
} from "@global_shared";
import {
    createCollectionWithItems,
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
        [true, ["0010_y.bru", "0020_x.bru"], "b/0020_x"],
        [false, ["0010_x.bru", "0010_y.bru"], "b/0010_x"],
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
                    runRequestBlock("a/0010_x"),
                ),
                "a/0010_x.bru": requestContent(CollectionFormat.Bru, "x", 10),
                "b/0010_y.bru": requestContent(CollectionFormat.Bru, "y", 10),
            });
            const itemProvider =
                createCollectionWithItems<TypedCollectionItemProvider>(
                    [
                        new BrunoRequestFile(join(directory, "caller.bru")),
                        new CollectionDirectory(join(directory, "a")),
                        new CollectionDirectory(join(directory, "b")),
                        new BrunoRequestFile(
                            join(directory, "a", "0010_x.bru"),
                            10,
                        ),
                        new BrunoRequestFile(
                            join(directory, "b", "0010_y.bru"),
                            10,
                        ),
                    ],
                    CollectionFormat.Bru,
                    [],
                    directory,
                ).itemProvider;

            await moveFileIntoFolder(
                itemProvider,
                join(directory, "a", "0010_x.bru"),
                join(directory, "b", "0010_x.bru"),
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
            "b/0020_y.bru": requestContent(CollectionFormat.Bru, "y", 10),
        });
        const { itemProvider } =
            createCollectionWithItems<TypedCollectionItemProvider>(
                [
                    new CollectionDirectory(join(directory, "a")),
                    new CollectionDirectory(join(directory, "b")),
                    new NonBrunoFile(join(directory, "a", "script.js")),
                    new BrunoRequestFile(join(directory, "a", "x.bru"), 10),
                    new BrunoRequestFile(
                        join(directory, "b", "0020_y.bru"),
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
            "0020_y.bru",
            "script.js",
        ]);
    });
});
