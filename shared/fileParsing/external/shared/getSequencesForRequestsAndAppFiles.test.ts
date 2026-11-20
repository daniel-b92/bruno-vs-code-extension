import { describe, it, expect } from "@jest/globals";
import { join } from "path";
import {
    CollectionFormat,
    CollectionItemProvider,
    getSequencesForRequestsAndAppFiles,
} from "../../..";
import {
    createItemProviderStub,
    useTemporaryDirectories,
} from "../../../_testingUtils";

describe("getSequencesForRequestsAndAppFiles", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    it("returns the sequences of request files and app files in a bru folder", async () => {
        const directory = await createTemporaryDirectory({
            "request.bru":
                "meta {\n  name: request\n  type: http\n  seq: 1\n}\n",
            "app.bru": "meta {\n  name: app\n  type: app\n  seq: 2\n}\n",
            "folder/folder.bru": "meta {\n  name: folder\n  seq: 3\n}\n",
        });

        expect(
            await getSortedSequences(directory, CollectionFormat.Bru),
        ).toEqual([
            { path: join(directory, "request.bru"), sequence: 1 },
            { path: join(directory, "app.bru"), sequence: 2 },
        ]);
    });

    it("returns the sequences of request files and app files in a yaml folder", async () => {
        const directory = await createTemporaryDirectory({
            "request.yml": [
                "info:",
                "  name: request",
                "  type: http",
                "  seq: 1",
                "",
                "http:",
                "  method: GET",
                "  url: http://localhost",
            ].join("\n"),
            "app.yml": ["info:", "  name: app", "  type: app", "  seq: 2"].join(
                "\n",
            ),
            "other.yml": ["info:", "  name: other", "  seq: 3"].join("\n"),
        });

        expect(
            await getSortedSequences(directory, CollectionFormat.Yaml),
        ).toEqual([
            { path: join(directory, "request.yml"), sequence: 1 },
            { path: join(directory, "app.yml"), sequence: 2 },
        ]);
    });
});

async function getSortedSequences(directory: string, format: CollectionFormat) {
    return (
        await getSequencesForRequestsAndAppFiles(
            createItemProviderStub<CollectionItemProvider<undefined>>(
                directory,
                format,
            ),
            directory,
        )
    ).sort(({ sequence: seq1 }, { sequence: seq2 }) => seq1 - seq2);
}
