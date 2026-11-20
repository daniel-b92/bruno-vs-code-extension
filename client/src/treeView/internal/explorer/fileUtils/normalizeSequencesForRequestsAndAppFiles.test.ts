import { describe, it, expect } from "@jest/globals";
import { readFile } from "fs/promises";
import { join } from "path";
import { CollectionFormat } from "@global_shared";
import {
    createItemProviderStub,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "@shared";
import { normalizeSequencesForRequestsAndAppFiles } from "./normalizeSequencesForRequestsAndAppFiles";

describe("normalizeSequencesForRequestsAndAppFiles", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    it("normalizes the sequences of request files and app files together", async () => {
        const directory = await createTemporaryDirectory({
            "first.bru": "meta {\n  name: first\n  type: http\n  seq: 2\n}\n",
            "app.bru": "meta {\n  name: app\n  type: app\n  seq: 5\n}\n",
            "second.bru": "meta {\n  name: second\n  type: http\n  seq: 9\n}\n",
        });

        await normalizeSequencesForRequestsAndAppFiles(
            createItemProviderStub<TypedCollectionItemProvider>(
                directory,
                CollectionFormat.Bru,
            ),
            directory,
        );

        expect(await readFile(join(directory, "first.bru"), "utf-8")).toContain(
            "seq: 1",
        );
        expect(await readFile(join(directory, "app.bru"), "utf-8")).toContain(
            "seq: 2",
        );
        expect(
            await readFile(join(directory, "second.bru"), "utf-8"),
        ).toContain("seq: 3");
    });
});
