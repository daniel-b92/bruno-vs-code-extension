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

    it("uses the configured step and sorts equal sequences by name when requested", async () => {
        const directory = await createTemporaryDirectory({
            "zeta.bru": "meta {\n  name: zeta\n  type: http\n  seq: 2\n}\n",
            "alpha.bru": "meta {\n  name: alpha\n  type: http\n  seq: 2\n}\n",
            "later.bru": "meta {\n  name: later\n  type: http\n  seq: 7\n}\n",
        });

        await normalizeSequencesForRequestsAndAppFiles(
            createItemProviderStub<TypedCollectionItemProvider>(
                directory,
                CollectionFormat.Bru,
            ),
            directory,
            10,
            true,
        );

        expect(await readFile(join(directory, "alpha.bru"), "utf-8")).toContain(
            "seq: 10",
        );
        expect(await readFile(join(directory, "zeta.bru"), "utf-8")).toContain(
            "seq: 20",
        );
        expect(await readFile(join(directory, "later.bru"), "utf-8")).toContain(
            "seq: 30",
        );
    });

    it("normalizes yaml request sequences with a configured step", async () => {
        const directory = await createTemporaryDirectory({
            "first.yml":
                "info:\n  name: first\n  type: http\n  seq: 2\n\nhttp:\n  method: GET\n",
            "second.yml":
                "info:\n  name: second\n  type: http\n  seq: 8\n\nhttp:\n  method: GET\n",
        });

        await normalizeSequencesForRequestsAndAppFiles(
            createItemProviderStub<TypedCollectionItemProvider>(
                directory,
                CollectionFormat.Yaml,
            ),
            directory,
            5,
            true,
        );

        expect(await readFile(join(directory, "first.yml"), "utf-8")).toContain(
            "seq: 5",
        );
        expect(
            await readFile(join(directory, "second.yml"), "utf-8"),
        ).toContain("seq: 10");
    });
});
