import {
    describe,
    it,
    expect,
    jest,
    afterEach,
    beforeEach,
} from "@jest/globals";
import { join } from "path";
import {
    BrunoRequestFile,
    CollectionDirectory,
    CollectionFormat,
    CollectionItem,
    getFileExtensionForFormat,
    NonBrunoFile,
} from "@global_shared";
import { createCollectionWithItems } from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "@shared";
import { mockVsCodeSettings } from "../../../../_testingUtils";
import { getNameUsedBySiblingOfInsertedItem } from "./getNameUsedBySiblingOfInsertedItem";

const rootDirectory = "/collection";
const sourceFolder = join(rootDirectory, "source");
const targetFolder = join(rootDirectory, "target");

describe("getNameUsedBySiblingOfInsertedItem", () => {
    beforeEach(() => {
        mockVsCodeSettings({ "bru-as-code.prefixNamesWithSequence": true });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe.each([CollectionFormat.Bru, CollectionFormat.Yaml])(
        "%s",
        (format) => {
            const extension = getFileExtensionForFormat(format);
            const createRequest = (
                folder: string,
                name: string,
                sequence?: number,
            ) =>
                new BrunoRequestFile(
                    join(folder, `${name}${extension}`),
                    sequence,
                );
            const createFolder = (
                parent: string,
                name: string,
                sequence: number,
            ) =>
                new CollectionDirectory(
                    join(parent, name),
                    join(parent, name, `folder${extension}`),
                    sequence,
                );
            const source = createRequest(sourceFolder, "0010_login", 10);
            const sibling = createRequest(targetFolder, "0020_login", 20);

            it("returns the name if a file only differs in the prefix", async () => {
                expect(await getUsedName(format, source, [sibling])).toBe(
                    `login${extension}`,
                );
                expect(
                    await getUsedName(format, source, [
                        createRequest(targetFolder, "login"),
                    ]),
                ).toBe(`login${extension}`);
            });

            it("returns the name if a folder only differs in the prefix", async () => {
                expect(
                    await getUsedName(
                        format,
                        createFolder(sourceFolder, "0010_users", 10),
                        [createFolder(targetFolder, "0020_users", 20)],
                    ),
                ).toBe("users");
            });

            it("returns the name of the sibling if it only differs in the prefix and the case", async () => {
                expect(
                    await getUsedName(format, source, [
                        createRequest(targetFolder, "0020_Login", 20),
                    ]),
                ).toBe(`Login${extension}`);
            });

            it("ignores items with other names, of another kind or in other folders", async () => {
                expect(
                    await getUsedName(format, source, [
                        createRequest(targetFolder, "0020_logout", 20),
                        createFolder(
                            targetFolder,
                            `0030_login${extension}`,
                            30,
                        ),
                        createRequest(rootDirectory, "0020_login", 20),
                    ]),
                ).toBeUndefined();
            });

            it("allows moving within the folder, even if a sibling only differs in the prefix already", async () => {
                const moved = createRequest(targetFolder, "0010_login", 10);

                expect(
                    await getUsedName(
                        format,
                        moved,
                        [sibling],
                        moved.getPath(),
                    ),
                ).toBeUndefined();
            });

            it("allows overwriting a file with the same name when pasting", async () => {
                const overwritten = createRequest(
                    targetFolder,
                    "0010_login",
                    10,
                );

                expect(
                    await getUsedName(
                        format,
                        source,
                        [overwritten],
                        overwritten.getPath(),
                    ),
                ).toBeUndefined();
            });

            it("returns the name if the copied file was renamed before it is pasted in the same folder", async () => {
                const copied = createRequest(targetFolder, "0010_login", 10);

                expect(
                    await getNameUsedBySiblingOfInsertedItem(
                        createCollection(format, [sibling]),
                        copied,
                        targetFolder,
                        copied.getPath(),
                    ),
                ).toBe(`login${extension}`);
            });

            it("ignores source items that cannot have a prefix", async () => {
                expect(
                    await getUsedName(
                        format,
                        new NonBrunoFile(join(sourceFolder, "data.json")),
                        [new NonBrunoFile(join(targetFolder, "data.json"))],
                    ),
                ).toBeUndefined();
            });

            it("returns undefined if the setting is disabled", async () => {
                mockVsCodeSettings({
                    "bru-as-code.prefixNamesWithSequence": false,
                });

                expect(
                    await getUsedName(format, source, [sibling]),
                ).toBeUndefined();
            });
        },
    );
});

async function getUsedName(
    format: CollectionFormat,
    source: CollectionItem,
    otherItems: CollectionItem[],
    replacedPath = source.getPath(),
) {
    return await getNameUsedBySiblingOfInsertedItem(
        createCollection(format, [source, ...otherItems]),
        source,
        targetFolder,
        replacedPath,
    );
}

function createCollection(format: CollectionFormat, items: CollectionItem[]) {
    return createCollectionWithItems<TypedCollectionItemProvider>(
        items,
        format,
        [],
        rootDirectory,
    ).collection;
}
