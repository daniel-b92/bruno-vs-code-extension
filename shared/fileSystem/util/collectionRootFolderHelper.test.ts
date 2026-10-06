import { describe, it, expect } from "@jest/globals";
import { basename } from "path";
import { useTemporaryDirectories } from "../../_testingUtils";
import { CollectionFormat } from "../../baseModel/interfaces";
import { getAllCollectionRootDirectories } from "./collectionRootFolderHelper";

describe("getAllCollectionRootDirectories", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    it("ignores yaml collections when the yaml toggle is off", async () => {
        const workspace = await createWorkspace();

        const roots = await getAllCollectionRootDirectories([workspace], {
            yamlCollectionSupport: false,
        });

        expect(getRootNamesWithFormat(roots)).toEqual([
            "bothFormats (Bru)",
            "bruCollection (Bru)",
        ]);
    });

    it("also finds yaml collections when the yaml toggle is on", async () => {
        const workspace = await createWorkspace();

        const roots = await getAllCollectionRootDirectories([workspace], {
            yamlCollectionSupport: true,
        });

        expect(getRootNamesWithFormat(roots)).toEqual([
            "bothFormats (Bru)",
            "bruCollection (Bru)",
            "yamlCollection (Yaml)",
        ]);
    });

    it("does not treat a folder as a yaml collection when 'opencollection.yml' is a directory", async () => {
        const workspace = await createTemporaryDirectory({
            "notACollection/opencollection.yml/child.txt": "",
        });

        const roots = await getAllCollectionRootDirectories([workspace], {
            yamlCollectionSupport: true,
        });

        expect(roots).toEqual([]);
    });

    async function createWorkspace() {
        const bruRequest = "meta {\n  name: req\n  type: http\n  seq: 1\n}\n";

        return await createTemporaryDirectory({
            "bruCollection/bruno.json": "{}",
            "bruCollection/req.bru": bruRequest,
            "yamlCollection/opencollection.yml": "info:\n  name: yaml\n",
            // When both root files exist, the bru format takes precedence.
            "bothFormats/bruno.json": "{}",
            "bothFormats/req.bru": bruRequest,
            "bothFormats/opencollection.yml": "info:\n  name: both\n",
        });
    }

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
