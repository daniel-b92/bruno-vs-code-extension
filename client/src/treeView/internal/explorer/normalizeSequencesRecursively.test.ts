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
                await parseSequenceFromFile(
                    join(directory, "root-request" + extension),
                ),
            ).toBe(5);
            expect(
                await parseSequenceFromFile(join(directory, "app" + extension)),
            ).toBe(10);
            expect(
                await parseSequenceFromFile(
                    join(directory, "alpha", settingsFileName),
                ),
            ).toBe(5);
            expect(
                await parseSequenceFromFile(
                    join(directory, "zeta", settingsFileName),
                ),
            ).toBe(10);
            expect(
                await parseSequenceFromFile(
                    join(directory, "alpha", "request" + extension),
                ),
            ).toBe(5);
            expect(
                await parseSequenceFromFile(
                    join(directory, "alpha", "nested", settingsFileName),
                ),
            ).toBe(5);
            expect(
                await parseSequenceFromFile(
                    join(directory, "alpha", "nested", "request" + extension),
                ),
            ).toBe(5);
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
