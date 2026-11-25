import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { join } from "path";
import {
    BrunoRequestFile,
    CollectionDirectory,
    CollectionFormat,
    CollectionItem,
    getFileExtensionForFormat,
} from "@global_shared";
import {
    createCollectionWithItems,
    requestContent,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "@shared";
import { mockVsCodeSettings } from "../../../_testingUtils";
import { getPathForDuplicatedItem } from "./getPathForDuplicatedItem";
import { getCheckForNamesOfDuplicatedItem } from "./sequencePrefixUtils/getCheckForNamesOfDuplicatedItem";

describe("getPathForDuplicatedItem", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it.each([CollectionFormat.Bru, CollectionFormat.Yaml])(
        "does not use names of files that only differ in the prefix (%s)",
        async (format) => {
            mockPrefixSetting(true);
            const extension = getFileExtensionForFormat(format);

            expect(await duplicateFile(format, ["0010_a"])).toBe(
                `0010_a_Copy${extension}`,
            );
            expect(await duplicateFile(format, ["0010_a", "0015_a_Copy"])).toBe(
                `0010_a_Copy1${extension}`,
            );
            expect(
                await duplicateFile(format, [
                    "0010_a",
                    "0015_a_Copy",
                    "0020_a_Copy1",
                ]),
            ).toBe(`0010_a_Copy2${extension}`);
        },
    );

    it.each([CollectionFormat.Bru, CollectionFormat.Yaml])(
        "does not use names of folders that only differ in the prefix (%s)",
        async (format) => {
            mockPrefixSetting(true);

            expect(await duplicateFolder(format, ["0010_a"])).toBe(
                "0010_a_Copy",
            );
            expect(
                await duplicateFolder(format, ["0010_a", "0020_a_Copy"]),
            ).toBe("0010_a_Copy1");
        },
    );

    it("ignores prefixes if the setting is disabled", async () => {
        mockPrefixSetting(false);

        expect(
            await duplicateFile(CollectionFormat.Bru, [
                "0010_a",
                "0015_a_Copy",
            ]),
        ).toBe("0010_a_Copy.bru");
    });

    it("does not use existing paths", async () => {
        mockPrefixSetting(false);

        expect(await duplicateFile(CollectionFormat.Bru, ["a", "a_Copy"])).toBe(
            "a_Copy1.bru",
        );
    });

    it("returns undefined if the original item does not exist", async () => {
        const directory = await createTemporaryDirectory();

        expect(
            await getPathForDuplicatedItem(join(directory, "a.bru")),
        ).toBeUndefined();
    });

    /** Determines the name for a duplicate of the first file. */
    async function duplicateFile(format: CollectionFormat, names: string[]) {
        const extension = getFileExtensionForFormat(format);

        return await getNameForDuplicate(
            format,
            names.map((name) => ({
                contentPath: `${name}${extension}`,
                content: requestContent(
                    format,
                    getStoredName(name),
                    getSequence(name),
                ),
                createItem: (directory) =>
                    new BrunoRequestFile(
                        join(directory, `${name}${extension}`),
                        getSequence(name),
                    ),
            })),
        );
    }

    /** Determines the name for a duplicate of the first folder. */
    async function duplicateFolder(format: CollectionFormat, names: string[]) {
        const extension = getFileExtensionForFormat(format);

        return await getNameForDuplicate(
            format,
            names.map((name) => ({
                contentPath: `${name}/folder${extension}`,
                content: folderSettingsContent(
                    format,
                    getStoredName(name),
                    getSequence(name),
                ),
                createItem: (directory) =>
                    new CollectionDirectory(
                        join(directory, name),
                        join(directory, name, `folder${extension}`),
                        getSequence(name),
                    ),
            })),
        );
    }

    async function getNameForDuplicate(
        format: CollectionFormat,
        data: {
            contentPath: string;
            content: string;
            createItem: (directory: string) => CollectionItem;
        }[],
    ) {
        const directory = await createTemporaryDirectory(
            Object.fromEntries(
                data.map(({ contentPath, content }) => [contentPath, content]),
            ),
        );
        const items = data.map(({ createItem }) => createItem(directory));
        const { collection } =
            createCollectionWithItems<TypedCollectionItemProvider>(
                items,
                format,
                [],
                directory,
            );
        const path = await getPathForDuplicatedItem(
            items[0].getPath(),
            await getCheckForNamesOfDuplicatedItem(collection, items[0]),
        );

        return path?.substring(directory.length + 1);
    }
});

function mockPrefixSetting(isEnabled: boolean) {
    mockVsCodeSettings({
        "bru-as-code.prefixNamesWithSequence": isEnabled,
        "bru-as-code.sequenceStep": 10,
    });
}

function getSequence(name: string) {
    const match = /^(\d+)_/.exec(name);
    return match ? Number.parseInt(match[1], 10) : undefined;
}

function getStoredName(name: string) {
    return name.replace(/^\d+_/, "");
}

function folderSettingsContent(
    format: CollectionFormat,
    name: string,
    sequence?: number,
) {
    return format == CollectionFormat.Bru
        ? `meta {\n  name: ${name}\n  seq: ${sequence}\n}\n`
        : `info:\n  name: ${name}\n  type: folder\n  seq: ${sequence}\n`;
}
