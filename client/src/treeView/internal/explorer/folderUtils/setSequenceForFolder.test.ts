import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { parse } from "yaml";
import { workspace } from "vscode";
import {
    CollectionDirectory,
    CollectionFormat,
    getFolderSettingsFileName,
} from "@global_shared";
import {
    createCollectionWithItems,
    folderSettingsContent,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "@shared";
import {
    applyWorkspaceEdit,
    mockVsCodeSettings,
} from "../../../../_testingUtils";
import { syncSequencePrefixes } from "../sequencePrefixUtils/syncSequencePrefixes";
import { setSequenceForFolder } from "./setSequenceForFolder";

describe("setSequenceForFolder", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("Bru format", () => {
        it("creates a minimal folder settings file, if there is none", async () => {
            const directory = await createTemporaryDirectory({
                "my-folder/request.bru": "",
            });

            const result = await set(directory, 5, CollectionFormat.Bru);

            expect(result).toBe(true);
            expect(await read(directory, "folder.bru")).toBe(
                "meta {\n  name: my-folder\n  seq: 5\n}\n",
            );
        });

        it("only replaces the sequence, if there is one", async () => {
            const content =
                "meta {\n  name: my-folder\n  seq: 1\n}\n\nvars:pre-request {\n  keepMe: 1\n}\n";
            const directory = await createFolderWithSettings(
                "folder.bru",
                content,
            );

            const result = await set(directory, 5, CollectionFormat.Bru);

            expect(result).toBe(true);
            expect(await read(directory, "folder.bru")).toBe(
                content.replace("seq: 1", "seq: 5"),
            );
        });

        it("adds the sequence to an existing meta block, keeping the other content", async () => {
            const directory = await createFolderWithSettings(
                "folder.bru",
                "meta {\n  name: my-folder\n}\n\nvars:pre-request {\n  keepMe: 1\n}\n",
            );

            const result = await set(directory, 5, CollectionFormat.Bru);

            expect(result).toBe(true);
            expect(await read(directory, "folder.bru")).toBe(
                "meta {\n  seq: 5\n  name: my-folder\n}\n\nvars:pre-request {\n  keepMe: 1\n}\n",
            );
        });

        it("keeps the line endings of the file", async () => {
            const directory = await createFolderWithSettings(
                "folder.bru",
                "meta {\r\n  name: my-folder\r\n}\r\n",
            );

            await set(directory, 5, CollectionFormat.Bru);

            expect(await read(directory, "folder.bru")).toBe(
                "meta {\r\n  seq: 5\r\n  name: my-folder\r\n}\r\n",
            );
        });

        it("adds a meta block in front of the other content, if there is none", async () => {
            const directory = await createFolderWithSettings(
                "folder.bru",
                "headers {\n  a: b\n}\n",
            );

            const result = await set(directory, 5, CollectionFormat.Bru);

            expect(result).toBe(true);
            expect(await read(directory, "folder.bru")).toBe(
                "meta {\n  name: my-folder\n  seq: 5\n}\n\nheaders {\n  a: b\n}\n",
            );
        });
    });

    describe("Yaml format", () => {
        it("creates a minimal folder settings file, if there is none", async () => {
            const directory = await createTemporaryDirectory({
                "my-folder/request.yml": "",
            });

            const result = await set(directory, 5, CollectionFormat.Yaml);

            expect(result).toBe(true);
            expect(await read(directory, "folder.yml")).toBe(
                "info:\n  name: my-folder\n  type: folder\n  seq: 5\n",
            );
        });

        it("quotes the folder name in the minimal file, if necessary", async () => {
            const directory = await createTemporaryDirectory({
                "123/request.yml": "",
            });

            const result = await setSequenceForFolder(
                join(directory, "123"),
                5,
                CollectionFormat.Yaml,
            );

            expect(result).toBe(true);
            expect(
                await readFile(join(directory, "123", "folder.yml"), "utf-8"),
            ).toBe('info:\n  name: "123"\n  type: folder\n  seq: 5\n');
        });

        it("quotes the folder name for a folder name with special characters", async () => {
            const directory = await createTemporaryDirectory({
                "API: v2 #1/request.yml": "",
            });

            await setSequenceForFolder(
                join(directory, "API: v2 #1"),
                5,
                CollectionFormat.Yaml,
            );

            const parsed = parse(
                await readFile(
                    join(directory, "API: v2 #1", "folder.yml"),
                    "utf-8",
                ),
            );
            expect(parsed.info).toEqual({
                name: "API: v2 #1",
                type: "folder",
                seq: 5,
            });
        });

        it("only replaces the sequence, if there is one", async () => {
            const content =
                "info:\n  name: my-folder\n  type: folder\n  seq: 1\nrequest:\n  headers: []\n";
            const directory = await createFolderWithSettings(
                "folder.yml",
                content,
            );

            const result = await set(directory, 5, CollectionFormat.Yaml);

            expect(result).toBe(true);
            expect(await read(directory, "folder.yml")).toBe(
                content.replace("seq: 1", "seq: 5"),
            );
        });

        it("adds the sequence to the existing info section with the same indentation", async () => {
            const directory = await createFolderWithSettings(
                "folder.yml",
                "info:\n    name: my-folder\n    type: folder\nrequest:\n  headers: []\n",
            );

            const result = await set(directory, 5, CollectionFormat.Yaml);

            expect(result).toBe(true);
            expect(await read(directory, "folder.yml")).toBe(
                "info:\n    seq: 5\n    name: my-folder\n    type: folder\nrequest:\n  headers: []\n",
            );
        });

        it("adds an info section in front of the other content, if there is none", async () => {
            const directory = await createFolderWithSettings(
                "folder.yml",
                "request:\n  headers: []\n",
            );

            const result = await set(directory, 5, CollectionFormat.Yaml);

            expect(result).toBe(true);
            expect(await read(directory, "folder.yml")).toBe(
                "info:\n  name: my-folder\n  type: folder\n  seq: 5\n\nrequest:\n  headers: []\n",
            );
        });

        it.each(["seq: abc", "seq:"])(
            "does not add a second sequence and reports a failure, if there is an invalid one ('%s')",
            async (invalidSequence) => {
                const content = `info:\n  name: my-folder\n  type: folder\n  ${invalidSequence}\nrequest:\n  headers: []\n`;
                const directory = await createFolderWithSettings(
                    "folder.yml",
                    content,
                );

                const result = await set(directory, 5, CollectionFormat.Yaml);

                expect(result).toBe(false);
                expect(await read(directory, "folder.yml")).toBe(content);
            },
        );

        it("adds the sequence, if only another section has a `seq` key", async () => {
            const directory = await createFolderWithSettings(
                "folder.yml",
                "info:\n  name: my-folder\n  type: folder\nrequest:\n  seq: 7\n",
            );

            const result = await set(directory, 5, CollectionFormat.Yaml);

            expect(result).toBe(true);
            expect(await read(directory, "folder.yml")).toBe(
                "info:\n  seq: 5\n  name: my-folder\n  type: folder\nrequest:\n  seq: 7\n",
            );
        });

        it("does not change the file and reports a failure for an unsupported info notation", async () => {
            const content = "info: {}\n";
            const directory = await createFolderWithSettings(
                "folder.yml",
                content,
            );

            const result = await set(directory, 5, CollectionFormat.Yaml);

            expect(result).toBe(false);
            expect(await read(directory, "folder.yml")).toBe(content);
        });
    });

    describe.each([CollectionFormat.Bru, CollectionFormat.Yaml])(
        "names with a sequence prefix (%s)",
        (format) => {
            const settingsFileName = getFolderSettingsFileName(format);
            const contentWithoutMetadata =
                format == CollectionFormat.Bru
                    ? "headers {\n  a: b\n}\n"
                    : "request:\n  headers: []\n";

            it.each([
                // Digits that were entered by the user are kept, even if they are padded with zeros.
                ["007_bond", "007_bond"],
                ["2024_reports", "2024_reports"],
                // Matches the new sequence.
                ["15_foo", "foo"],
                ["00015_foo", "foo"],
            ])(
                "stores the name of the folder '%s' as '%s', if the setting is enabled",
                async (folderName, expectedName) => {
                    mockPrefixSetting(true);

                    expect(
                        await getContentAfterSettingSequence(folderName),
                    ).toBe(folderSettingsContent(format, expectedName, 15));
                    expect(
                        await getContentAfterSettingSequence(
                            folderName,
                            contentWithoutMetadata,
                        ),
                    ).toBe(
                        `${folderSettingsContent(format, expectedName, 15)}\n${contentWithoutMetadata}`,
                    );
                },
            );

            it("stores the unchanged name of the folder, if the setting is disabled", async () => {
                mockPrefixSetting(false);

                expect(await getContentAfterSettingSequence("0010_foo")).toBe(
                    folderSettingsContent(format, "0010_foo", 15),
                );
                expect(
                    await getContentAfterSettingSequence(
                        "0010_foo",
                        contentWithoutMetadata,
                    ),
                ).toBe(
                    `${folderSettingsContent(format, "0010_foo", 15)}\n${contentWithoutMetadata}`,
                );
            });

            it.each([
                ["007_bond", "00015_007_bond"],
                ["2024_reports", "00015_2024_reports"],
                ["15_foo", "00015_foo"],
            ])(
                "makes the same decision about the prefix of '%s' as the sync afterwards",
                async (folderName, expectedFolderName) => {
                    mockPrefixSetting(true);
                    jest.spyOn(workspace, "applyEdit").mockImplementation(
                        applyWorkspaceEdit,
                    );
                    const directory = await createTemporaryDirectory({
                        [`${folderName}/request.txt`]: "",
                    });
                    const folderPath = join(directory, folderName);

                    await setSequenceForFolder(folderPath, 15, format);
                    await syncSequencePrefixes(
                        createCollectionWithItems<TypedCollectionItemProvider>(
                            [
                                new CollectionDirectory(
                                    folderPath,
                                    join(folderPath, settingsFileName),
                                    15,
                                ),
                            ],
                            format,
                            [],
                            directory,
                        ).itemProvider,
                        [directory],
                    );

                    expect(await readdir(directory)).toEqual([
                        expectedFolderName,
                    ]);
                },
            );

            async function getContentAfterSettingSequence(
                folderName: string,
                existingContent?: string,
            ) {
                const directory = await createTemporaryDirectory({
                    [`${folderName}/request.txt`]: "",
                    ...(existingContent === undefined
                        ? {}
                        : {
                              [`${folderName}/${settingsFileName}`]:
                                  existingContent,
                          }),
                });
                const folderPath = join(directory, folderName);

                expect(await setSequenceForFolder(folderPath, 15, format)).toBe(
                    true,
                );

                return await readFile(
                    join(folderPath, settingsFileName),
                    "utf-8",
                );
            }
        },
    );

    async function createFolderWithSettings(fileName: string, content: string) {
        return await createTemporaryDirectory({
            [`my-folder/${fileName}`]: content,
        });
    }

    async function set(
        directory: string,
        sequence: number,
        format: CollectionFormat,
    ) {
        return await setSequenceForFolder(
            join(directory, "my-folder"),
            sequence,
            format,
        );
    }

    async function read(directory: string, fileName: string) {
        return await readFile(join(directory, "my-folder", fileName), "utf-8");
    }
});

function mockPrefixSetting(enabled: boolean) {
    mockVsCodeSettings({ "bru-as-code.prefixNamesWithSequence": enabled });
}
