import { describe, it, expect } from "@jest/globals";
import { join } from "path";
import {
    BrunoEnvironmentFile,
    BrunoFileType,
    BrunoRequestFile,
    CollectionDirectory,
    CollectionFormat,
    NonBrunoFile,
    NonBrunoSpecificItemType,
} from "../..";
import {
    createCollectionWithEnvironments,
    useTemporaryDirectories,
} from "../../_testingUtils";
import {
    getCollectionItem,
    getCollectionItemForFile,
} from "./getCollectionItem";

describe("getCollectionItemForFile", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    it("caches a valid top level 'extends' field", async () => {
        const filePath = await createFileInTemporaryDirectory(
            "Test.bru",
            `extends: Base\n\nvars {\n  first: 1\n}`,
        );

        const result = (await getCollectionItemForFile(
            filePath,
            BrunoFileType.EnvironmentFile,
            CollectionFormat.Bru,
        )) as BrunoEnvironmentFile;

        expect(result.getExtends()).toBe("Base");
        expect(result.getVariables()).toEqual([
            expect.objectContaining({ key: "first", value: "1" }),
        ]);
    });

    it("does not cache an 'extends' field when it is defined multiple times", async () => {
        const filePath = await createFileInTemporaryDirectory(
            "Test.bru",
            `extends: Base\nextends: Other\n\nvars {\n  first: 1\n}`,
        );

        const result = (await getCollectionItemForFile(
            filePath,
            BrunoFileType.EnvironmentFile,
            CollectionFormat.Bru,
        )) as BrunoEnvironmentFile;

        expect(result.getExtends()).toBeUndefined();
    });

    it("caches no 'extends' field when none is present", async () => {
        const filePath = await createFileInTemporaryDirectory(
            "Test.bru",
            `vars {\n  first: 1\n}`,
        );

        const result = (await getCollectionItemForFile(
            filePath,
            BrunoFileType.EnvironmentFile,
            CollectionFormat.Bru,
        )) as BrunoEnvironmentFile;

        expect(result.getExtends()).toBeUndefined();
    });
    it("returns a NonBrunoFile for OtherFileType", async () => {
        const result = await getCollectionItemForFile(
            "/some/path/script.js",
            NonBrunoSpecificItemType.OtherFileType,
            CollectionFormat.Bru,
        );

        expect(result).toBeInstanceOf(NonBrunoFile);
        expect(result?.getPath()).toBe("/some/path/script.js");
        expect(result?.getItemType()).toBe(
            NonBrunoSpecificItemType.OtherFileType,
        );
    });

    it("returns undefined for an unknown item type", async () => {
        const result = await getCollectionItemForFile(
            "/some/path/unknown",
            "unknown" as BrunoFileType,
            CollectionFormat.Bru,
        );

        expect(result).toBeUndefined();
    });

    describe("for the yaml format", () => {
        it("caches sequence and tags of a request file", async () => {
            const path = await createFileInTemporaryDirectory(
                "request.yml",
                `info:\n  name: Req\n  type: http\n  seq: 3\n  tags:\n    - smoke\n    - other\nhttp:\n  method: GET\n  url: http://localhost\n`,
            );

            const result = (await getCollectionItemForFile(
                path,
                BrunoFileType.RequestFile,
                CollectionFormat.Yaml,
            )) as BrunoRequestFile;

            expect(result).toBeInstanceOf(BrunoRequestFile);
            expect(result.getSequence()).toBe(3);
            expect(result.getTags()).toEqual(["smoke", "other"]);
        });

        it("still returns a request file when the info section is invalid", async () => {
            const path = await createFileInTemporaryDirectory(
                "request.yml",
                "foo: bar\n",
            );

            const result = (await getCollectionItemForFile(
                path,
                BrunoFileType.RequestFile,
                CollectionFormat.Yaml,
            )) as BrunoRequestFile;

            expect(result).toBeInstanceOf(BrunoRequestFile);
            expect(result.getSequence()).toBeUndefined();
            expect(result.getTags()).toBeUndefined();
        });

        it("caches extends field and enabled variables of an environment file", async () => {
            const path = await createFileInTemporaryDirectory(
                "Dev.yml",
                [
                    "name: Dev",
                    "extends: Base",
                    "variables:",
                    "  - name: first",
                    '    value: "1"',
                    "  - name: typed",
                    "    value:",
                    "      type: number",
                    '      data: "2"',
                    "  - name: disabledVar",
                    "    value: x",
                    "    disabled: true",
                    "  - secret: true",
                    "    name: secretVar",
                    "",
                ].join("\n"),
            );

            const result = (await getCollectionItemForFile(
                path,
                BrunoFileType.EnvironmentFile,
                CollectionFormat.Yaml,
            )) as BrunoEnvironmentFile;

            expect(result.getExtends()).toBe("Base");
            expect(
                result.getVariables().map(({ key, value }) => ({ key, value })),
            ).toEqual([
                { key: "first", value: "1" },
                { key: "typed", value: "2" },
            ]);
        });

        it("returns an environment file without variables when the file is not valid yaml", async () => {
            const path = await createFileInTemporaryDirectory(
                "Dev.yml",
                "variables: [unclosed\n",
            );

            const result = (await getCollectionItemForFile(
                path,
                BrunoFileType.EnvironmentFile,
                CollectionFormat.Yaml,
            )) as BrunoEnvironmentFile;

            expect(result.getVariables()).toEqual([]);
            expect(result.getExtends()).toBeUndefined();
        });
    });

    describe("for directories in a yaml collection", () => {
        it("caches the sequence of the folder settings file", async () => {
            const root = await createTemporaryDirectory({
                "Folder1/folder.yml":
                    "info:\n  name: Folder1\n  type: folder\n  seq: 7\n",
            });
            const collection = createCollectionWithEnvironments(
                [],
                root,
                CollectionFormat.Yaml,
            );

            const result = (await getCollectionItem(collection, {
                path: join(root, "Folder1"),
                itemType: NonBrunoSpecificItemType.Directory,
            })) as CollectionDirectory;

            expect(result.getSequence()).toBe(7);
            expect(result.getSettingsFilePath()).toBe(
                join(root, "Folder1", "folder.yml"),
            );
        });

        it("returns a directory without sequence when there is no folder settings file", async () => {
            const root = await createTemporaryDirectory({
                "Folder1/request.yml": "info:\n  name: r\n  type: http\n",
            });
            const collection = createCollectionWithEnvironments(
                [],
                root,
                CollectionFormat.Yaml,
            );

            const result = (await getCollectionItem(collection, {
                path: join(root, "Folder1"),
                itemType: NonBrunoSpecificItemType.Directory,
            })) as CollectionDirectory;

            expect(result.getSequence()).toBeUndefined();
            expect(result.getSettingsFilePath()).toBeUndefined();
        });
    });

    async function createFileInTemporaryDirectory(
        name: string,
        content: string,
    ) {
        return join(await createTemporaryDirectory({ [name]: content }), name);
    }
});
