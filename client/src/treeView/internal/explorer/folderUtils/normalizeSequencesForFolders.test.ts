import { describe, it, expect } from "@jest/globals";
import { readFile } from "fs/promises";
import { join } from "path";
import { CollectionFormat } from "@global_shared";
import {
    createItemProviderStub,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "@shared";
import { normalizeSequencesForFolders } from "./normalizeSequencesForFolders";

describe("normalizeSequencesForFolders", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    it.each([
        [
            CollectionFormat.Bru,
            "folder.bru",
            (name: string, sequence: number) =>
                [
                    "meta {",
                    "  name: NAME",
                    "  type: folder",
                    "  seq: SEQUENCE",
                    "}",
                    "",
                ]
                    .join("\n")
                    .replace("NAME", name)
                    .replace("SEQUENCE", String(sequence)),
        ],
        [
            CollectionFormat.Yaml,
            "folder.yml",
            (name: string, sequence: number) =>
                [
                    "info:",
                    "  name: NAME",
                    "  type: folder",
                    "  seq: SEQUENCE",
                    "",
                ]
                    .join("\n")
                    .replace("NAME", name)
                    .replace("SEQUENCE", String(sequence)),
        ],
    ] as const)(
        "uses the configured step and sorts equal sequences by name for %s",
        async (format, settingsFileName, content) => {
            const directory = await createTemporaryDirectory({
                ["zeta/" + settingsFileName]: content("zeta", 2),
                ["alpha/" + settingsFileName]: content("alpha", 2),
            });

            await normalizeSequencesForFolders(
                createItemProviderStub<TypedCollectionItemProvider>(
                    directory,
                    format,
                ),
                directory,
                10,
                true,
            );

            expect(
                await readFile(
                    join(directory, "alpha", settingsFileName),
                    "utf-8",
                ),
            ).toContain("seq: 10");
            expect(
                await readFile(
                    join(directory, "zeta", settingsFileName),
                    "utf-8",
                ),
            ).toContain("seq: 20");
        },
    );
});
