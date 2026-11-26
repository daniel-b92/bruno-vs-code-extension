import {
    describe,
    it,
    expect,
    jest,
    afterEach,
    beforeEach,
} from "@jest/globals";
import { join } from "path";
import { readdir, readFile } from "fs/promises";
import { workspace } from "vscode";
import {
    BrunoRequestFile,
    CollectionDirectory,
    CollectionFormat,
    checkIfPathExistsAsync,
    normalizePath,
} from "@global_shared";
import {
    createCollectionWithItems,
    folderSettingsContent,
    requestContent,
    runRequestBlock,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "@shared";
import {
    applyWorkspaceEdit,
    mockVsCodeSettings,
} from "../../../../_testingUtils";
import { getPathAfterRenames } from "../runRequestPaths/getEditsForRunRequestPaths";
import { syncSequencePrefixes } from "./syncSequencePrefixes";

describe("syncSequencePrefixes", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("does nothing if names should not be prefixed with the sequence", async () => {
        mockVsCodeSettings({ "bru-as-code.sequenceStep": 10 });
        const applyEdit = jest.spyOn(workspace, "applyEdit");
        const { directory, itemProvider } = await setUpCollection(
            createTemporaryDirectory,
        );

        const renamed = await syncSequencePrefixes(itemProvider, [directory]);

        expect(renamed).toEqual([]);
        expect(applyEdit).not.toHaveBeenCalled();
    });

    it("prefixes requests and folders with their sequence", async () => {
        mockVsCodeSettings({
            "bru-as-code.prefixNamesWithSequence": true,
            "bru-as-code.sequenceStep": 10,
        });
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );
        const { directory, itemProvider } = await setUpCollection(
            createTemporaryDirectory,
        );

        const renamed = await syncSequencePrefixes(itemProvider, [directory]);

        expect(
            await Promise.all(
                [
                    "00010_first.bru",
                    "00020_users",
                    "00025_second.bru",
                    "no-sequence.bru",
                ].map((name) => checkIfPathExistsAsync(join(directory, name))),
            ),
        ).toEqual([true, true, true, true]);
        expect(getPathAfterRenames(join(directory, "first.bru"), renamed)).toBe(
            join(directory, "00010_first.bru"),
        );
    });

    it("replaces outdated prefixes", async () => {
        mockVsCodeSettings({
            "bru-as-code.prefixNamesWithSequence": true,
            "bru-as-code.sequenceStep": 10,
        });
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );
        const { directory, itemProvider } = await setUpCollection(
            createTemporaryDirectory,
            { first: "00050_first.bru" },
        );

        await syncSequencePrefixes(itemProvider, [directory]);

        expect(
            await checkIfPathExistsAsync(join(directory, "00010_first.bru")),
        ).toBe(true);
        expect(
            await checkIfPathExistsAsync(join(directory, "00050_first.bru")),
        ).toBe(false);
    });

    it.each([
        [CollectionFormat.Bru, "folder.bru"],
        [CollectionFormat.Yaml, "folder.yml"],
    ])(
        "does not rename the environments folder of a %s collection",
        async (format, settingsFileName) => {
            mockVsCodeSettings(prefixSettings);
            const applyEdit = jest.spyOn(workspace, "applyEdit");
            const directory = await createTemporaryDirectory({
                [`environments/${settingsFileName}`]: folderSettingsContent(
                    format,
                    "environments",
                    10,
                ),
            });
            const itemProvider = createItemProvider(
                directory,
                [
                    new CollectionDirectory(
                        join(directory, "environments"),
                        join(directory, "environments", settingsFileName),
                        10,
                    ),
                ],
                format,
            );

            expect(
                await syncSequencePrefixes(itemProvider, [directory]),
            ).toEqual([]);
            expect(applyEdit).not.toHaveBeenCalled();
        },
    );

    it("does not overwrite existing items", async () => {
        mockVsCodeSettings({
            "bru-as-code.prefixNamesWithSequence": true,
            "bru-as-code.sequenceStep": 10,
        });
        const applyEdit = jest
            .spyOn(workspace, "applyEdit")
            .mockImplementation(applyWorkspaceEdit);
        const { directory, itemProvider } = await setUpCollection(
            createTemporaryDirectory,
            { first: "first.bru", extraFiles: ["00010_first.bru"] },
        );

        const renamed = await syncSequencePrefixes(itemProvider, [directory]);

        expect(renamed.map(({ sourcePath }) => sourcePath)).not.toContain(
            join(directory, "first.bru"),
        );
        expect(await checkIfPathExistsAsync(join(directory, "first.bru"))).toBe(
            true,
        );
        // Only the other items are renamed, all of them together.
        expect(applyEdit).toHaveBeenCalledTimes(1);
        expect(
            (applyEdit.mock.calls[0][0] as unknown as MockedEdit).renames.map(
                ({ from }) => from.fsPath,
            ),
        ).toEqual(
            expect.arrayContaining([
                join(directory, "second.bru"),
                join(directory, "users"),
            ]),
        );
    });

    it("prefixes requests and folders in a yaml collection", async () => {
        mockVsCodeSettings(prefixSettings);
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );
        const directory = await createTemporaryDirectory({
            "first.yml": requestContent(CollectionFormat.Yaml, "first", 10),
            "users/folder.yml":
                "info:\n  name: users\n  type: folder\n  seq: 20\n",
            "no-sequence.yml": requestContent(
                CollectionFormat.Yaml,
                "no-sequence",
            ),
        });
        const itemProvider = createItemProvider(
            directory,
            [
                new BrunoRequestFile(join(directory, "first.yml"), 10),
                new CollectionDirectory(
                    join(directory, "users"),
                    join(directory, "users", "folder.yml"),
                    20,
                ),
                new BrunoRequestFile(join(directory, "no-sequence.yml")),
            ],
            CollectionFormat.Yaml,
        );

        await syncSequencePrefixes(itemProvider, [directory]);

        expect((await readdir(directory)).sort()).toEqual([
            "00010_first.yml",
            "00020_users",
            "no-sequence.yml",
        ]);
    });

    describe("when items take over the names of items that are renamed as well", () => {
        beforeEach(() => {
            mockVsCodeSettings(prefixSettings);
            jest.spyOn(workspace, "applyEdit").mockImplementation(
                applyWorkspaceEdit,
            );
        });

        it("renames items that were shifted by an insertion even if they have the same name", async () => {
            const directory = await createTemporaryDirectory({
                "00005_login.bru": requestContent(
                    CollectionFormat.Bru,
                    "login",
                    10,
                ),
                "00010_login.bru": requestContent(
                    CollectionFormat.Bru,
                    "login",
                    20,
                ),
                "00020_login.bru": requestContent(
                    CollectionFormat.Bru,
                    "login",
                    30,
                ),
            });
            const itemProvider = createItemProvider(directory, [
                new BrunoRequestFile(join(directory, "00005_login.bru"), 10),
                new BrunoRequestFile(join(directory, "00010_login.bru"), 20),
                new BrunoRequestFile(join(directory, "00020_login.bru"), 30),
            ]);

            await syncSequencePrefixes(itemProvider, [directory]);

            expect(await readdir(directory)).toEqual([
                "00010_login.bru",
                "00020_login.bru",
                "00030_login.bru",
            ]);
            expect(
                await readFile(join(directory, "00010_login.bru"), "utf-8"),
            ).toContain("seq: 10");
        });

        it("swaps the names of items", async () => {
            const directory = await createTemporaryDirectory({
                "00010_login.bru": requestContent(
                    CollectionFormat.Bru,
                    "login",
                    20,
                ),
                "00020_login.bru": requestContent(
                    CollectionFormat.Bru,
                    "login",
                    10,
                ),
            });
            const itemProvider = createItemProvider(directory, [
                new BrunoRequestFile(join(directory, "00010_login.bru"), 20),
                new BrunoRequestFile(join(directory, "00020_login.bru"), 10),
            ]);

            await syncSequencePrefixes(itemProvider, [directory]);

            expect(await readdir(directory)).toEqual([
                "00010_login.bru",
                "00020_login.bru",
            ]);
            expect(
                await readFile(join(directory, "00010_login.bru"), "utf-8"),
            ).toContain("seq: 10");
        });

        it("renames nested items together with their folder", async () => {
            const directory = await createTemporaryDirectory({
                "00010_users/folder.bru":
                    "meta {\n  name: users\n  seq: 20\n}\n",
                "00010_users/first.bru": requestContent(
                    CollectionFormat.Bru,
                    "first",
                    10,
                ),
            });
            const itemProvider = createItemProvider(directory, [
                new CollectionDirectory(
                    join(directory, "00010_users"),
                    join(directory, "00010_users", "folder.bru"),
                    20,
                ),
                new BrunoRequestFile(
                    join(directory, "00010_users", "first.bru"),
                    10,
                ),
            ]);

            await syncSequencePrefixes(itemProvider, [
                directory,
                join(directory, "00010_users"),
            ]);

            expect(await readdir(join(directory, "00020_users"))).toEqual([
                "00010_first.bru",
                "folder.bru",
            ]);
        });
    });

    it.each([CollectionFormat.Bru, CollectionFormat.Yaml])(
        "uses the same number of digits for every configured step in %s collections",
        async (format) => {
            const extension = format === CollectionFormat.Bru ? ".bru" : ".yml";
            const directory = await createTemporaryDirectory({
                [`i${extension}`]: requestContent(format, "i", 900),
                [`j${extension}`]: requestContent(format, "j", 1000),
            });
            const expectedNames = [
                `00900_i${extension}`,
                `01000_j${extension}`,
            ];
            const applyEdit = jest
                .spyOn(workspace, "applyEdit")
                .mockImplementation(applyWorkspaceEdit);

            for (const sequenceStep of [1, 5, 10, 100]) {
                mockVsCodeSettings({
                    ...prefixSettings,
                    "bru-as-code.sequenceStep": sequenceStep,
                });
                await syncSequencePrefixes(
                    createItemProvider(directory, [], format),
                    [directory],
                );

                expect((await readdir(directory)).sort()).toEqual(
                    expectedNames,
                );
            }

            // Only the first sync has to rename anything.
            expect(applyEdit).toHaveBeenCalledTimes(1);
        },
    );

    it("returns the final location of an item whose ancestor folder is renamed as well", async () => {
        mockVsCodeSettings(prefixSettings);
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );
        const directory = await createTemporaryDirectory({
            "users/folder.bru": "meta {\n  name: users\n  seq: 10\n}\n",
            "users/login.bru": requestContent(
                CollectionFormat.Bru,
                "login",
                10,
            ),
        });
        const itemProvider = createItemProvider(directory, [
            new CollectionDirectory(
                join(directory, "users"),
                join(directory, "users", "folder.bru"),
                10,
            ),
            new BrunoRequestFile(join(directory, "users", "login.bru"), 10),
        ]);

        const renamed = await syncSequencePrefixes(itemProvider, [
            directory,
            join(directory, "users"),
        ]);

        expect(
            getPathAfterRenames(join(directory, "users", "login.bru"), renamed),
        ).toBe(join(directory, "00010_users", "00010_login.bru"));
        expect(
            await checkIfPathExistsAsync(
                join(directory, "00010_users", "00010_login.bru"),
            ),
        ).toBe(true);
    });

    it("keeps digits at the start of a name that are part of the stored name", async () => {
        mockVsCodeSettings({
            "bru-as-code.prefixNamesWithSequence": true,
            "bru-as-code.sequenceStep": 1,
        });
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );
        const directory = await createTemporaryDirectory({
            "2024_reports.bru": requestContent(
                CollectionFormat.Bru,
                "2024_reports",
                2,
            ),
            "404_error.bru": requestContent(
                CollectionFormat.Bru,
                "404_error",
                3,
            ),
            "500_error/folder.bru": "meta {\n  name: 500_error\n  seq: 4\n}\n",
        });
        const itemProvider = createItemProvider(directory, []);

        await syncSequencePrefixes(itemProvider, [directory]);
        const namesAfterFirstSync = (await readdir(directory)).sort();
        await syncSequencePrefixes(itemProvider, [directory]);

        expect(namesAfterFirstSync).toEqual([
            "00002_2024_reports.bru",
            "00003_404_error.bru",
            "00004_500_error",
        ]);
        expect((await readdir(directory)).sort()).toEqual(namesAfterFirstSync);
    });

    it("replaces outdated prefixes without padding", async () => {
        mockVsCodeSettings({
            "bru-as-code.prefixNamesWithSequence": true,
            "bru-as-code.sequenceStep": 1,
        });
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );
        const directory = await createTemporaryDirectory({
            "1000_login.yml": requestContent(CollectionFormat.Yaml, "login", 3),
            "2000_users/folder.yml":
                "info:\n  name: users\n  type: folder\n  seq: 4\n",
        });
        const itemProvider = createItemProvider(
            directory,
            [],
            CollectionFormat.Yaml,
        );

        await syncSequencePrefixes(itemProvider, [directory]);

        expect((await readdir(directory)).sort()).toEqual([
            "00003_login.yml",
            "00004_users",
        ]);
    });

    it.each([
        [
            "keeps digits that do not match the previous sequence",
            2,
            "404_error",
        ],
        ["replaces digits that match the previous sequence", 404, "error"],
        [
            "keeps digits if no previous sequence is known",
            undefined,
            "404_error",
        ],
    ])(
        "%s if the stored name is a different one",
        async (_, previousSequence, expectedName) => {
            mockVsCodeSettings({
                "bru-as-code.prefixNamesWithSequence": true,
                "bru-as-code.sequenceStep": 1,
            });
            jest.spyOn(workspace, "applyEdit").mockImplementation(
                applyWorkspaceEdit,
            );
            const directory = await createTemporaryDirectory({
                "404_error.bru": requestContent(
                    CollectionFormat.Bru,
                    "Error 404",
                    3,
                ),
            });

            await syncSequencePrefixes(
                createItemProvider(directory, []),
                [directory],
                {
                    previousSequences:
                        previousSequence === undefined
                            ? undefined
                            : new Map([
                                  [
                                      normalizePath(
                                          join(directory, "404_error.bru"),
                                      ),
                                      previousSequence,
                                  ],
                              ]),
                },
            );

            expect(await readdir(directory)).toEqual([
                `00003_${expectedName}.bru`,
            ]);
        },
    );

    it("finds the previous sequence of an item that was moved before", async () => {
        mockVsCodeSettings({
            "bru-as-code.prefixNamesWithSequence": true,
            "bru-as-code.sequenceStep": 1,
        });
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );
        const directory = await createTemporaryDirectory({
            "b/100_login.bru": requestContent(
                CollectionFormat.Bru,
                "Something else",
                1,
            ),
        });
        const sourcePath = join(directory, "a", "100_login.bru");

        await syncSequencePrefixes(
            createItemProvider(directory, [
                new CollectionDirectory(join(directory, "b")),
            ]),
            [join(directory, "b")],
            {
                previousSequences: new Map([[normalizePath(sourcePath), 100]]),
                previousRenames: [
                    {
                        sourcePath,
                        targetPath: join(directory, "b", "100_login.bru"),
                        isFile: true,
                    },
                ],
            },
        );

        expect(await readdir(join(directory, "b"))).toEqual([
            "00001_login.bru",
        ]);
    });

    it("keeps the names of items whose sequence cannot be used as a prefix", async () => {
        mockVsCodeSettings(prefixSettings);
        const applyEdit = jest.spyOn(workspace, "applyEdit");
        const directory = await createTemporaryDirectory({
            "a.bru": requestContent(CollectionFormat.Bru, "a", 1.5),
            "b.bru": requestContent(CollectionFormat.Bru, "b", -1),
        });

        await syncSequencePrefixes(createItemProvider(directory, []), [
            directory,
        ]);

        expect(applyEdit).not.toHaveBeenCalled();
    });

    describe("paths in `bru.runRequest` calls", () => {
        beforeEach(() => {
            mockVsCodeSettings(prefixSettings);
            jest.spyOn(workspace, "applyEdit").mockImplementation(
                applyWorkspaceEdit,
            );
        });

        it("are updated in requests that are renamed themselves", async () => {
            const directory = await createTemporaryDirectory({
                "first.bru": requestContent(
                    CollectionFormat.Bru,
                    "first",
                    10,
                    runRequestBlock("second"),
                ),
                "second.bru": requestContent(
                    CollectionFormat.Bru,
                    "second",
                    20,
                    runRequestBlock("first"),
                ),
            });
            const itemProvider = createItemProvider(directory, [
                new BrunoRequestFile(join(directory, "first.bru"), 10),
                new BrunoRequestFile(join(directory, "second.bru"), 20),
            ]);

            await syncSequencePrefixes(itemProvider, [directory]);

            expect(
                await readFile(join(directory, "00010_first.bru"), "utf-8"),
            ).toContain('runRequest("00020_second")');
            expect(
                await readFile(join(directory, "00020_second.bru"), "utf-8"),
            ).toContain('runRequest("00010_first")');
        });

        it("are updated for requests within renamed folders", async () => {
            const directory = await createTemporaryDirectory({
                "caller.bru": requestContent(
                    CollectionFormat.Bru,
                    "caller",
                    10,
                    runRequestBlock("users/a"),
                ),
                "users/folder.bru": "meta {\n  name: users\n  seq: 20\n}\n",
                "users/a.bru": requestContent(CollectionFormat.Bru, "a", 5),
            });
            const itemProvider = createItemProvider(directory, [
                new BrunoRequestFile(join(directory, "caller.bru"), 10),
                new CollectionDirectory(
                    join(directory, "users"),
                    join(directory, "users", "folder.bru"),
                    20,
                ),
                new BrunoRequestFile(join(directory, "users", "a.bru"), 5),
            ]);

            await syncSequencePrefixes(itemProvider, [
                directory,
                join(directory, "users"),
            ]);

            expect(
                await readFile(join(directory, "00010_caller.bru"), "utf-8"),
            ).toContain('runRequest("00020_users/00005_a")');
        });

        it("are updated in a created file that the collection data does not know yet", async () => {
            const directory = await createTemporaryDirectory({
                "00010_a.bru": requestContent(
                    CollectionFormat.Bru,
                    "a",
                    10,
                    runRequestBlock("00020_b"),
                ),
                "00020_a_Copy.bru": requestContent(
                    CollectionFormat.Bru,
                    "a_Copy",
                    20,
                    runRequestBlock("00020_b"),
                ),
                "00020_b.bru": requestContent(CollectionFormat.Bru, "b", 30),
            });
            const itemProvider = createItemProvider(directory, [
                new BrunoRequestFile(join(directory, "00010_a.bru"), 10),
                new BrunoRequestFile(join(directory, "00020_b.bru"), 30),
            ]);

            await syncSequencePrefixes(itemProvider, [directory], {
                uncachedItemPaths: [join(directory, "00020_a_Copy.bru")],
            });

            for (const name of ["00010_a.bru", "00020_a_Copy.bru"]) {
                expect(
                    await readFile(join(directory, name), "utf-8"),
                ).toContain('runRequest("00030_b")');
            }
        });

        it("are updated in the files of a created folder that the collection data does not know yet", async () => {
            const directory = await createTemporaryDirectory({
                "00010_b.bru": requestContent(CollectionFormat.Bru, "b", 20),
                "users_Copy/caller.bru": requestContent(
                    CollectionFormat.Bru,
                    "caller",
                    undefined,
                    runRequestBlock("00010_b"),
                ),
            });
            const itemProvider = createItemProvider(directory, [
                new BrunoRequestFile(join(directory, "00010_b.bru"), 20),
            ]);

            await syncSequencePrefixes(itemProvider, [directory], {
                uncachedItemPaths: [join(directory, "users_Copy")],
            });

            expect(
                await readFile(
                    join(directory, "users_Copy", "caller.bru"),
                    "utf-8",
                ),
            ).toContain('runRequest("00020_b")');
        });

        it("are updated for a request that was moved and is renamed afterwards, before the collection data knows its new location", async () => {
            const directory = await createTemporaryDirectory({
                "caller.bru": requestContent(
                    CollectionFormat.Bru,
                    "caller",
                    10,
                    runRequestBlock("b/00010_x"),
                ),
                "b/00010_y.bru": requestContent(CollectionFormat.Bru, "y", 10),
                "b/00010_x.bru": requestContent(CollectionFormat.Bru, "x", 20),
            });
            const itemProvider = createItemProvider(directory, [
                new BrunoRequestFile(join(directory, "caller.bru"), 10),
                new CollectionDirectory(join(directory, "b")),
                // The moved request is still registered with its old location.
                new BrunoRequestFile(join(directory, "a", "00010_x.bru"), 10),
                new BrunoRequestFile(join(directory, "b", "00010_y.bru"), 10),
            ]);

            await syncSequencePrefixes(itemProvider, [join(directory, "b")], {
                previousRenames: [
                    {
                        sourcePath: join(directory, "a", "00010_x.bru"),
                        targetPath: join(directory, "b", "00010_x.bru"),
                        isFile: true,
                    },
                ],
            });

            expect(await readdir(join(directory, "b"))).toEqual([
                "00010_y.bru",
                "00020_x.bru",
            ]);
            expect(
                await readFile(join(directory, "caller.bru"), "utf-8"),
            ).toContain('runRequest("b/00020_x")');
        });

        it("are updated in a request that was moved before, if it references a renamed request", async () => {
            const directory = await createTemporaryDirectory({
                "b/00010_caller.bru": requestContent(
                    CollectionFormat.Bru,
                    "caller",
                    10,
                    runRequestBlock("b/00010_x"),
                ),
                "b/00010_x.bru": requestContent(CollectionFormat.Bru, "x", 20),
            });
            const itemProvider = createItemProvider(directory, [
                new CollectionDirectory(join(directory, "b")),
                // The caller is still registered with its old location.
                new BrunoRequestFile(
                    join(directory, "a", "00010_caller.bru"),
                    10,
                ),
                new BrunoRequestFile(join(directory, "b", "00010_x.bru"), 20),
            ]);

            await syncSequencePrefixes(itemProvider, [join(directory, "b")], {
                previousRenames: [
                    {
                        sourcePath: join(directory, "a"),
                        targetPath: join(directory, "b"),
                        isFile: false,
                    },
                ],
            });

            expect(
                await readFile(
                    join(directory, "b", "00010_caller.bru"),
                    "utf-8",
                ),
            ).toContain('runRequest("b/00020_x")');
        });
    });
});

const prefixSettings = {
    "bru-as-code.prefixNamesWithSequence": true,
    "bru-as-code.sequenceStep": 10,
};

type MockedEdit = { renames: { from: { fsPath: string } }[] };

async function setUpCollection(
    createTemporaryDirectory: ReturnType<typeof useTemporaryDirectories>,
    options: { first?: string; extraFiles?: string[] } = {},
) {
    const firstFileName = options.first ?? "first.bru";
    const directory = await createTemporaryDirectory({
        [firstFileName]: requestContent(CollectionFormat.Bru, "first", 10),
        "second.bru": requestContent(CollectionFormat.Bru, "second", 25),
        "no-sequence.bru": "meta {\n  name: no-sequence\n  type: http\n}\n",
        "users/folder.bru": "meta {\n  name: users\n  seq: 20\n}\n",
        ...Object.fromEntries(
            (options.extraFiles ?? []).map((name) => [name, "x"]),
        ),
    });

    return {
        directory,
        itemProvider: createItemProvider(directory, [
            new BrunoRequestFile(join(directory, firstFileName), 10),
            new BrunoRequestFile(join(directory, "second.bru"), 25),
            new CollectionDirectory(
                join(directory, "users"),
                join(directory, "users", "folder.bru"),
                20,
            ),
        ]),
    };
}

function createItemProvider(
    directory: string,
    items: (BrunoRequestFile | CollectionDirectory)[],
    format = CollectionFormat.Bru,
) {
    return createCollectionWithItems<TypedCollectionItemProvider>(
        items,
        format,
        [],
        directory,
    ).itemProvider;
}
