import { describe, it, expect } from "@jest/globals";
import { join } from "path";
import {
    BrunoAppFile,
    BrunoRequestFile,
    CollectionDirectory,
    CollectionFormat,
    parseSequenceFromFile,
} from "@global_shared";
import {
    createCollectionWithEnvironments,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { normalizeSequencesRecursively } from "./normalizeSequencesRecursively";

describe("normalizeSequencesRecursively", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    it.each([
        [CollectionFormat.Bru, ".", [5, 10, 5, 10, 5, 5, 5]],
        [CollectionFormat.Yaml, ".", [5, 10, 5, 10, 5, 5, 5]],
        // Items outside of a selected subfolder must stay untouched.
        [CollectionFormat.Bru, "alpha", [7, 9, 4, 4, 5, 5, 5]],
        [CollectionFormat.Yaml, "alpha", [7, 9, 4, 4, 5, 5, 5]],
    ] as const)(
        "normalizes items in %s collections below folder '%s'",
        async (format, selectedFolder, expectedSequences) => {
            const extension = format === CollectionFormat.Bru ? ".bru" : ".yml";
            const settingsFileName =
                format === CollectionFormat.Bru ? "folder.bru" : "folder.yml";
            const directory = await createTemporaryDirectory({
                ["root-request" + extension]: requestContent(
                    format,
                    "root request",
                    7,
                ),
                ["app" + extension]: appContent(format, "app", 9),
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
            for (const [relativePath, sequence] of [
                ["alpha", 4],
                ["alpha/nested", 9],
                ["zeta", 4],
            ] as const) {
                collection.addItem({
                    item: new CollectionDirectory(
                        join(directory, relativePath),
                        join(directory, relativePath, settingsFileName),
                        sequence,
                    ),
                    additionalData: undefined,
                });
            }
            collection.addItem({
                item: new BrunoRequestFile(
                    join(directory, "root-request" + extension),
                    7,
                ),
                additionalData: undefined,
            });
            collection.addItem({
                item: new BrunoAppFile(join(directory, "app" + extension), 9),
                additionalData: undefined,
            });
            collection.addItem({
                item: new BrunoRequestFile(
                    join(directory, "alpha", "request" + extension),
                    8,
                ),
                additionalData: undefined,
            });
            collection.addItem({
                item: new BrunoRequestFile(
                    join(directory, "alpha", "nested", "request" + extension),
                    2,
                ),
                additionalData: undefined,
            });
            await normalizeSequencesRecursively(
                collection,
                join(directory, selectedFolder),
                5,
            );

            const actualSequences = await Promise.all(
                [
                    "root-request" + extension,
                    "app" + extension,
                    join("alpha", settingsFileName),
                    join("zeta", settingsFileName),
                    join("alpha", "request" + extension),
                    join("alpha", "nested", settingsFileName),
                    join("alpha", "nested", "request" + extension),
                ].map((relativePath) =>
                    parseSequenceFromFile(join(directory, relativePath)),
                ),
            );
            expect(actualSequences).toEqual(expectedSequences);
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

function appContent(format: CollectionFormat, name: string, sequence: number) {
    if (format === CollectionFormat.Bru) {
        return [
            "meta {",
            "  name: " + name,
            "  type: app",
            "  seq: " + sequence,
            "}",
            "",
        ].join("\n");
    }

    return [
        "info:",
        "  name: " + name,
        "  type: app",
        "  seq: " + sequence,
        "",
    ].join("\n");
}
