import { describe, it, expect } from "@jest/globals";
import { basename, join } from "path";
import { useTemporaryDirectories } from "../../_testingUtils";
import { CollectionFormat } from "../../baseModel/interfaces";
import { getAllCollectionRootDirectories } from "./collectionRootFolderHelper";

describe("getAllCollectionRootDirectories", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    it("finds bru and yaml collections", async () => {
        const workspace = await createWorkspace();

        const { roots, conflicts } = await getAllCollectionRootDirectories([
            workspace,
        ]);

        expect(getRootNamesWithFormat(roots)).toEqual([
            "bruCollection (Bru)",
            "yamlCollection (Yaml)",
        ]);
        expect(
            conflicts.map(({ rootFilePath }) => rootFilePath).sort(),
        ).toEqual([
            join(workspace, "bothFormats", "bruno.json"),
            join(workspace, "bothFormats", "opencollection.yml"),
        ]);
    });

    it("ignores a root that contains another root in a subdirectory", async () => {
        const workspace = await createTemporaryDirectory({
            "outer/bruno.json": "{}",
            "outer/req.bru": bruRequest,
            "outer/inner/opencollection.yml": "info:\n  name: yaml\n",
        });

        const { roots, conflicts } = await getAllCollectionRootDirectories([
            workspace,
        ]);

        expect(getRootNamesWithFormat(roots)).toEqual(["inner (Yaml)"]);
        expect(conflicts).toEqual([
            {
                rootFilePath: join(workspace, "outer", "bruno.json"),
                conflictingFilePaths: [
                    join(workspace, "outer", "inner", "opencollection.yml"),
                ],
            },
        ]);
    });

    it("does not treat an environment named 'opencollection' as a conflicting root file", async () => {
        const workspace = await createTemporaryDirectory({
            "yamlCollection/opencollection.yml": "info:\n  name: yaml\n",
            "yamlCollection/environments/opencollection.yml": "name: env\n",
        });

        const { roots, conflicts } = await getAllCollectionRootDirectories([
            workspace,
        ]);

        expect(getRootNamesWithFormat(roots)).toEqual([
            "yamlCollection (Yaml)",
        ]);
        expect(conflicts).toEqual([]);
    });

    it("does not let a stray 'bruno.json' hide a yaml collection", async () => {
        const workspace = await createTemporaryDirectory({
            "col/bruno.json": "{}",
            "col/opencollection.yml": "info:\n  name: yaml\n",
        });

        const { roots, conflicts } = await getAllCollectionRootDirectories([
            workspace,
        ]);

        expect(getRootNamesWithFormat(roots)).toEqual(["col (Yaml)"]);
        expect(conflicts).toEqual([]);
    });

    it("finds a yaml collection located in a folder named 'environments'", async () => {
        const workspace = await createTemporaryDirectory({
            "environments/opencollection.yml": "info:\n  name: yaml\n",
        });

        const { roots } = await getAllCollectionRootDirectories([workspace]);

        expect(getRootNamesWithFormat(roots)).toEqual(["environments (Yaml)"]);
    });

    it("detects nested bru collections", async () => {
        const workspace = await createTemporaryDirectory({
            "outer/bruno.json": "{}",
            "outer/req.bru": bruRequest,
            "outer/inner/bruno.json": "{}",
            "outer/inner/req.bru": bruRequest,
        });

        const { roots, conflicts } = await getAllCollectionRootDirectories([
            workspace,
        ]);

        expect(getRootNamesWithFormat(roots)).toEqual(["inner (Bru)"]);
        expect(conflicts.map(({ rootFilePath }) => rootFilePath)).toEqual([
            join(workspace, "outer", "bruno.json"),
        ]);
    });

    it("does not treat a request named 'opencollection' as a nested collection root", async () => {
        const workspace = await createTemporaryDirectory({
            "api/opencollection.yml": "info:\n  name: api\n",
            "api/users/opencollection.yml":
                "info:\n  name: users\n  type: http\n  seq: 1\n",
        });

        const { roots, conflicts } = await getAllCollectionRootDirectories([
            workspace,
        ]);

        expect(getRootNamesWithFormat(roots)).toEqual(["api (Yaml)"]);
        expect(conflicts).toEqual([]);
    });

    it("does not treat a folder as a yaml collection when 'opencollection.yml' is a directory", async () => {
        const workspace = await createTemporaryDirectory({
            "notACollection/opencollection.yml/child.txt": "",
        });

        const { roots } = await getAllCollectionRootDirectories([workspace]);

        expect(roots).toEqual([]);
    });

    async function createWorkspace() {
        return await createTemporaryDirectory({
            "bruCollection/bruno.json": "{}",
            "bruCollection/req.bru": bruRequest,
            "yamlCollection/opencollection.yml": "info:\n  name: yaml\n",
            // When both root files exist in one directory, they conflict with each other.
            "bothFormats/bruno.json": "{}",
            "bothFormats/req.bru": bruRequest,
            "bothFormats/opencollection.yml": "info:\n  name: both\n",
        });
    }

    const bruRequest = "meta {\n  name: req\n  type: http\n  seq: 1\n}\n";

    function getRootNamesWithFormat(
        roots: { rootFolder: string; format: CollectionFormat }[],
    ) {
        return roots
            .map(({ rootFolder, format }) => ({
                name: basename(rootFolder),
                format,
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(({ name, format }) => `${name} (${format})`);
    }
});
