import { describe, it, expect } from "@jest/globals";
import { readFile } from "fs/promises";
import { join } from "path";
import { CollectionDirectory, CollectionFormat } from "@global_shared";
import {
    createCollectionWithEnvironments,
    createItemProviderStub,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "@shared";
import { normalizeSequencesRecursively } from "./normalizeSequencesRecursively";

describe("normalizeSequencesRecursively", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    it.each([CollectionFormat.Bru, CollectionFormat.Yaml])(
        "normalizes requests and folders recursively in %s collections",
        async (format) => {
            const extension = format === CollectionFormat.Bru ? ".bru" : ".yml";
            const settingsFileName =
                format === CollectionFormat.Bru ? "folder.bru" : "folder.yml";
            const directory = await createTemporaryDirectory({
                ["root-request" + extension]: requestContent(
                    format,
                    "root request",
                    7,
                ),
                ["zeta/" + settingsFileName]: folderContent(format, "zeta", 4),
                ["alpha/" + settingsFileName]: folderContent(
                    format,
                    "alpha",
                    4,
                ),
                ["alpha/request" + extension]: requestContent(
                    format,
                    "request",
                    8,
                ),
                ["alpha/nested/" + settingsFileName]: folderContent(
                    format,
                    "nested",
                    9,
                ),
                ["alpha/nested/request" + extension]: requestContent(
                    format,
                    "nested request",
                    2,
                ),
            });

            const collection = createCollectionWithEnvironments(
                [],
                format,
                directory,
            );
            for (const relativePath of ["alpha", "alpha/nested", "zeta"]) {
                collection.addItem({
                    item: new CollectionDirectory(
                        join(directory, relativePath),
                    ),
                    additionalData: undefined,
                });
            }
            const itemProvider =
                createItemProviderStub<TypedCollectionItemProvider>(
                    directory,
                    format,
                    collection,
                );

            await normalizeSequencesRecursively(
                itemProvider,
                directory,
                directory,
                5,
            );

            expect(
                await readFile(
                    join(directory, "root-request" + extension),
                    "utf-8",
                ),
            ).toContain("seq: 5");
            expect(
                await readFile(
                    join(directory, "alpha", settingsFileName),
                    "utf-8",
                ),
            ).toContain("seq: 5");
            expect(
                await readFile(
                    join(directory, "zeta", settingsFileName),
                    "utf-8",
                ),
            ).toContain("seq: 10");
            expect(
                await readFile(
                    join(directory, "alpha", "request" + extension),
                    "utf-8",
                ),
            ).toContain("seq: 5");
            expect(
                await readFile(
                    join(directory, "alpha", "nested", settingsFileName),
                    "utf-8",
                ),
            ).toContain("seq: 5");
            expect(
                await readFile(
                    join(directory, "alpha", "nested", "request" + extension),
                    "utf-8",
                ),
            ).toContain("seq: 5");
        },
    );
});

function requestContent(
    format: CollectionFormat,
    name: string,
    sequence: number,
) {
    if (format === CollectionFormat.Bru) {
        return [
            "meta {",
            "  name: " + name,
            "  type: http",
            "  seq: " + sequence,
            "}",
            "",
        ].join("\n");
    }

    return [
        "info:",
        "  name: " + name,
        "  type: http",
        "  seq: " + sequence,
        "",
        "http:",
        "  method: GET",
        "",
    ].join("\n");
}

function folderContent(
    format: CollectionFormat,
    name: string,
    sequence: number,
) {
    if (format === CollectionFormat.Bru) {
        return [
            "meta {",
            "  name: " + name,
            "  type: folder",
            "  seq: " + sequence,
            "}",
            "",
        ].join("\n");
    }

    return [
        "info:",
        "  name: " + name,
        "  type: folder",
        "  seq: " + sequence,
        "",
    ].join("\n");
}
