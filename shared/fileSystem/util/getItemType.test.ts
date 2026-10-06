import { describe, it, expect } from "@jest/globals";
import { join } from "path";
import {
    createCollectionWithEnvironments,
    useTemporaryDirectories,
} from "../../_testingUtils";
import {
    BrunoFileType,
    CollectionFormat,
    NonBrunoSpecificItemType,
} from "../../baseModel/interfaces";
import { getItemType } from "./getItemType";

describe("getItemType", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    describe("for yaml collections", () => {
        it.each([
            ["opencollection.yml", BrunoFileType.CollectionSettingsFile],
            ["Folder1/folder.yml", BrunoFileType.FolderSettingsFile],
            ["environments/Dev.yml", BrunoFileType.EnvironmentFile],
            ["Folder1/http.yml", BrunoFileType.RequestFile],
            ["Folder1/graphql.yml", BrunoFileType.RequestFile],
            ["Folder1/grpc.yml", BrunoFileType.RequestFile],
            ["Folder1/websocket.yml", BrunoFileType.RequestFile],
            ["Folder1/app.yml", BrunoFileType.AppFile],
            ["Folder1/noInfo.yml", NonBrunoSpecificItemType.OtherFileType],
            [
                "Folder1/unknownInfoType.yml",
                NonBrunoSpecificItemType.OtherFileType,
            ],
            ["Folder1/invalid.yml", NonBrunoSpecificItemType.OtherFileType],
            ["Folder1/legacy.bru", NonBrunoSpecificItemType.OtherFileType],
            ["Folder1/readme.md", NonBrunoSpecificItemType.OtherFileType],
            ["Folder1", NonBrunoSpecificItemType.Directory],
        ])("determines the type of '%s'", async (relativePath, expected) => {
            const root = await createYamlCollectionDirectory();
            const collection = createCollectionWithEnvironments(
                [],
                root,
                CollectionFormat.Yaml,
            );

            expect(
                await getItemType(collection, join(root, relativePath)),
            ).toBe(expected);
        });

        it("does not treat a folder settings file name as such in the root directory", async () => {
            const root = await createTemporaryDirectory({
                "folder.yml": "info:\n  name: x\n  type: folder\n  seq: 1\n",
            });
            const collection = createCollectionWithEnvironments(
                [],
                root,
                CollectionFormat.Yaml,
            );

            expect(
                await getItemType(collection, join(root, "folder.yml")),
            ).toBe(NonBrunoSpecificItemType.OtherFileType);
        });

        it("returns undefined for a path that does not exist", async () => {
            const root = await createYamlCollectionDirectory();
            const collection = createCollectionWithEnvironments(
                [],
                root,
                CollectionFormat.Yaml,
            );

            expect(
                await getItemType(collection, join(root, "missing.yml")),
            ).toBeUndefined();
        });
    });

    describe("for bru collections", () => {
        it.each([
            ["collection.bru", BrunoFileType.CollectionSettingsFile],
            ["Folder1/folder.bru", BrunoFileType.FolderSettingsFile],
            ["environments/Dev.bru", BrunoFileType.EnvironmentFile],
            ["Folder1/request.bru", BrunoFileType.RequestFile],
            // Yaml files are never treated as bru files, regardless of their content.
            ["Folder1/http.yml", NonBrunoSpecificItemType.OtherFileType],
            ["opencollection.yml", NonBrunoSpecificItemType.OtherFileType],
        ])("determines the type of '%s'", async (relativePath, expected) => {
            const root = await createTemporaryDirectory({
                "collection.bru": "auth {\n  mode: none\n}\n",
                "Folder1/folder.bru": "meta {\n  name: Folder1\n  seq: 1\n}\n",
                "environments/Dev.bru": "vars {\n  a: 1\n}\n",
                "Folder1/request.bru":
                    "meta {\n  name: request\n  type: http\n  seq: 1\n}\n",
                "Folder1/http.yml": "info:\n  name: http\n  type: http\n",
                "opencollection.yml": "info:\n  name: x\n",
            });
            const collection = createCollectionWithEnvironments([], root);

            expect(
                await getItemType(collection, join(root, relativePath)),
            ).toBe(expected);
        });
    });

    async function createYamlCollectionDirectory() {
        return await createTemporaryDirectory({
            "opencollection.yml": "info:\n  name: collection\n",
            "Folder1/folder.yml":
                "info:\n  name: Folder1\n  type: folder\n  seq: 1\n",
            "environments/Dev.yml": "name: Dev\nvariables: []\n",
            "Folder1/http.yml": "info:\n  name: http\n  type: http\n  seq: 1\n",
            "Folder1/graphql.yml":
                "info:\n  name: graphql\n  type: graphql\n  seq: 2\n",
            "Folder1/grpc.yml": "info:\n  name: grpc\n  type: grpc\n  seq: 3\n",
            "Folder1/websocket.yml":
                "info:\n  name: websocket\n  type: websocket\n  seq: 4\n",
            "Folder1/app.yml":
                "info:\n  name: app\n  type: app\n  seq: 5\ncode: x\n",
            "Folder1/noInfo.yml": "foo: bar\n",
            "Folder1/unknownInfoType.yml": "info:\n  name: x\n  type: other\n",
            "Folder1/invalid.yml": "info: [unclosed\n",
            "Folder1/legacy.bru": "meta {\n  name: legacy\n  seq: 1\n}\n",
            "Folder1/readme.md": "# readme\n",
        });
    }
});
