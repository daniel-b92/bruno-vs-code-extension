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
} from "@global_shared";
import {
    createCollectionWithItems,
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
                    "0010_first.bru",
                    "0020_users",
                    "0025_second.bru",
                    "no-sequence.bru",
                ].map((name) => checkIfPathExistsAsync(join(directory, name))),
            ),
        ).toEqual([true, true, true, true]);
        expect(getPathAfterRenames(join(directory, "first.bru"), renamed)).toBe(
            join(directory, "0010_first.bru"),
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
            { first: "0050_first.bru" },
        );

        await syncSequencePrefixes(itemProvider, [directory]);

        expect(
            await checkIfPathExistsAsync(join(directory, "0010_first.bru")),
        ).toBe(true);
        expect(
            await checkIfPathExistsAsync(join(directory, "0050_first.bru")),
        ).toBe(false);
    });

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
            { first: "first.bru", extraFiles: ["0010_first.bru"] },
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
            "first.yml": yamlRequestContent("first", 10),
            "users/folder.yml":
                "info:\n  name: users\n  type: folder\n  seq: 20\n",
            "no-sequence.yml": yamlRequestContent("no-sequence"),
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
            "0010_first.yml",
            "0020_users",
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
                "0005_login.bru": requestContent("login", 10),
                "0010_login.bru": requestContent("login", 20),
                "0020_login.bru": requestContent("login", 30),
            });
            const itemProvider = createItemProvider(directory, [
                new BrunoRequestFile(join(directory, "0005_login.bru"), 10),
                new BrunoRequestFile(join(directory, "0010_login.bru"), 20),
                new BrunoRequestFile(join(directory, "0020_login.bru"), 30),
            ]);

            await syncSequencePrefixes(itemProvider, [directory]);

            expect(await readdir(directory)).toEqual([
                "0010_login.bru",
                "0020_login.bru",
                "0030_login.bru",
            ]);
            expect(
                await readFile(join(directory, "0010_login.bru"), "utf-8"),
            ).toContain("seq: 10");
        });

        it("swaps the names of items", async () => {
            const directory = await createTemporaryDirectory({
                "0010_login.bru": requestContent("login", 20),
                "0020_login.bru": requestContent("login", 10),
            });
            const itemProvider = createItemProvider(directory, [
                new BrunoRequestFile(join(directory, "0010_login.bru"), 20),
                new BrunoRequestFile(join(directory, "0020_login.bru"), 10),
            ]);

            await syncSequencePrefixes(itemProvider, [directory]);

            expect(await readdir(directory)).toEqual([
                "0010_login.bru",
                "0020_login.bru",
            ]);
            expect(
                await readFile(join(directory, "0010_login.bru"), "utf-8"),
            ).toContain("seq: 10");
        });

        it("renames nested items together with their folder", async () => {
            const directory = await createTemporaryDirectory({
                "0010_users/folder.bru":
                    "meta {\n  name: users\n  seq: 20\n}\n",
                "0010_users/first.bru": requestContent("first", 10),
            });
            const itemProvider = createItemProvider(directory, [
                new CollectionDirectory(
                    join(directory, "0010_users"),
                    join(directory, "0010_users", "folder.bru"),
                    20,
                ),
                new BrunoRequestFile(
                    join(directory, "0010_users", "first.bru"),
                    10,
                ),
            ]);

            await syncSequencePrefixes(itemProvider, [
                directory,
                join(directory, "0010_users"),
            ]);

            expect(await readdir(join(directory, "0020_users"))).toEqual([
                "0010_first.bru",
                "folder.bru",
            ]);
        });
    });

    it("uses the given step for the number of digits instead of the one of the settings", async () => {
        mockVsCodeSettings({
            "bru-as-code.prefixNamesWithSequence": true,
            "bru-as-code.sequenceStep": 1,
        });
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );
        const directory = await createTemporaryDirectory({
            "a.bru": requestContent("a", 200),
            "b.bru": requestContent("b", 1000),
        });
        const itemProvider = createItemProvider(directory, [
            new BrunoRequestFile(join(directory, "a.bru"), 200),
            new BrunoRequestFile(join(directory, "b.bru"), 1000),
        ]);

        await syncSequencePrefixes(itemProvider, [directory], {
            sequenceStep: 100,
        });

        expect((await readdir(directory)).sort()).toEqual([
            "00200_a.bru",
            "01000_b.bru",
        ]);
    });

    it("returns the final location of an item whose ancestor folder is renamed as well", async () => {
        mockVsCodeSettings(prefixSettings);
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );
        const directory = await createTemporaryDirectory({
            "users/folder.bru": "meta {\n  name: users\n  seq: 10\n}\n",
            "users/login.bru": requestContent("login", 10),
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
        ).toBe(join(directory, "0010_users", "0010_login.bru"));
        expect(
            await checkIfPathExistsAsync(
                join(directory, "0010_users", "0010_login.bru"),
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
            "2024_reports.bru": requestContent("2024_reports", 2),
            "404_error.bru": requestContent("404_error", 3),
            "500_error/folder.bru": "meta {\n  name: 500_error\n  seq: 4\n}\n",
        });
        const itemProvider = createItemProvider(directory, []);

        await syncSequencePrefixes(itemProvider, [directory]);
        const namesAfterFirstSync = (await readdir(directory)).sort();
        await syncSequencePrefixes(itemProvider, [directory]);

        expect(namesAfterFirstSync).toEqual([
            "002_2024_reports.bru",
            "003_404_error.bru",
            "004_500_error",
        ]);
        expect((await readdir(directory)).sort()).toEqual(namesAfterFirstSync);
    });

    it("replaces outdated prefixes with more digits than needed for the step", async () => {
        mockVsCodeSettings({
            "bru-as-code.prefixNamesWithSequence": true,
            "bru-as-code.sequenceStep": 1,
        });
        jest.spyOn(workspace, "applyEdit").mockImplementation(
            applyWorkspaceEdit,
        );
        const directory = await createTemporaryDirectory({
            "1000_login.yml": yamlRequestContent("login", 3),
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
            "003_login.yml",
            "004_users",
        ]);
    });

    it("keeps the names of items whose sequence cannot be used as a prefix", async () => {
        mockVsCodeSettings(prefixSettings);
        const applyEdit = jest.spyOn(workspace, "applyEdit");
        const directory = await createTemporaryDirectory({
            "a.bru": requestContent("a", 1.5),
            "b.bru": requestContent("b", -1),
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
                "first.bru": requestContent("first", 10, callOf("second")),
                "second.bru": requestContent("second", 20, callOf("first")),
            });
            const itemProvider = createItemProvider(directory, [
                new BrunoRequestFile(join(directory, "first.bru"), 10),
                new BrunoRequestFile(join(directory, "second.bru"), 20),
            ]);

            await syncSequencePrefixes(itemProvider, [directory]);

            expect(
                await readFile(join(directory, "0010_first.bru"), "utf-8"),
            ).toContain('runRequest("0020_second")');
            expect(
                await readFile(join(directory, "0020_second.bru"), "utf-8"),
            ).toContain('runRequest("0010_first")');
        });

        it("are updated for requests within renamed folders", async () => {
            const directory = await createTemporaryDirectory({
                "caller.bru": requestContent("caller", 10, callOf("users/a")),
                "users/folder.bru": "meta {\n  name: users\n  seq: 20\n}\n",
                "users/a.bru": requestContent("a", 5),
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
                await readFile(join(directory, "0010_caller.bru"), "utf-8"),
            ).toContain('runRequest("0020_users/0005_a")');
        });

        it("are updated for a request that was moved and is renamed afterwards, before the collection data knows its new location", async () => {
            const directory = await createTemporaryDirectory({
                "caller.bru": requestContent("caller", 10, callOf("b/0010_x")),
                "b/0010_y.bru": requestContent("y", 10),
                "b/0010_x.bru": requestContent("x", 20),
            });
            const itemProvider = createItemProvider(directory, [
                new BrunoRequestFile(join(directory, "caller.bru"), 10),
                new CollectionDirectory(join(directory, "b")),
                // The moved request is still registered with its old location.
                new BrunoRequestFile(join(directory, "a", "0010_x.bru"), 10),
                new BrunoRequestFile(join(directory, "b", "0010_y.bru"), 10),
            ]);

            await syncSequencePrefixes(itemProvider, [join(directory, "b")], {
                previousRenames: [
                    {
                        sourcePath: join(directory, "a", "0010_x.bru"),
                        targetPath: join(directory, "b", "0010_x.bru"),
                        isFile: true,
                    },
                ],
            });

            expect(await readdir(join(directory, "b"))).toEqual([
                "0010_y.bru",
                "0020_x.bru",
            ]);
            expect(
                await readFile(join(directory, "caller.bru"), "utf-8"),
            ).toContain('runRequest("b/0020_x")');
        });

        it("are updated in a request that was moved before, if it references a renamed request", async () => {
            const directory = await createTemporaryDirectory({
                "b/0010_caller.bru": requestContent(
                    "caller",
                    10,
                    callOf("b/0010_x"),
                ),
                "b/0010_x.bru": requestContent("x", 20),
            });
            const itemProvider = createItemProvider(directory, [
                new CollectionDirectory(join(directory, "b")),
                // The caller is still registered with its old location.
                new BrunoRequestFile(
                    join(directory, "a", "0010_caller.bru"),
                    10,
                ),
                new BrunoRequestFile(join(directory, "b", "0010_x.bru"), 20),
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
                    join(directory, "b", "0010_caller.bru"),
                    "utf-8",
                ),
            ).toContain('runRequest("b/0020_x")');
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
        [firstFileName]: requestContent("first", 10),
        "second.bru": requestContent("second", 25),
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

function requestContent(name: string, sequence: number, script = "") {
    return `meta {\n  name: ${name}\n  type: http\n  seq: ${sequence}\n}\n${script}`;
}

function callOf(path: string) {
    return `\nscript:pre-request {\n  await bru.runRequest("${path}");\n}\n`;
}

function yamlRequestContent(name: string, sequence?: number) {
    return `info:\n  name: ${name}\n  type: http\n${sequence === undefined ? "" : `  seq: ${sequence}\n`}http:\n  method: GET\n  url: ""\n`;
}
