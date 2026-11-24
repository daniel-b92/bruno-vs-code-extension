import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { readFile } from "fs/promises";
import { join } from "path";
import { window } from "vscode";
import {
    BrunoFileType,
    BrunoRequestFile,
    CollectionFormat,
    CollectionItem,
    NonBrunoFile,
} from "@global_shared";
import {
    createCollectionWithEnvironments,
    createItemProviderStub,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "@shared";
import { mockVsCodeSettings } from "../../../../_testingUtils";
import { handleFileInsertion } from "./handleFileInsertion";
import { RequestFileInsertionPositionType } from "./interfaces";

describe("handleFileInsertion", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("does not rename an existing file at the target path when copying the source file failed", async () => {
        const existingContent =
            "meta {\n  name: unrelated\n  type: http\n  seq: 1\n}\n";
        const directory = await createTemporaryDirectory({
            "target.bru": existingContent,
        });
        const showErrorMessage = jest
            .spyOn(window, "showErrorMessage")
            .mockResolvedValue(undefined);
        const targetPath = join(directory, "target.bru");

        const result = await handleFileInsertion(
            {
                getItemType: () => BrunoFileType.RequestFile,
                // The source file does not exist, so copying it fails.
                getPath: () => join(directory, "missing.bru"),
            } as unknown as CollectionItem,
            {
                insertionPosition: RequestFileInsertionPositionType.Folder,
                newPath: targetPath,
            },
            createItemProviderStub<TypedCollectionItemProvider>(
                directory,
                CollectionFormat.Bru,
            ),
        );

        expect(result).toBe(false);
        expect(await readFile(targetPath, "utf-8")).toBe(existingContent);
        expect(showErrorMessage).toHaveBeenCalledTimes(1);
    });

    it.each([
        [
            "in the 'environments' folder of the collection",
            "environments",
            true,
        ],
        [
            "in an 'environments' folder further down the tree",
            "sub/environments",
            false,
        ],
    ])(
        "asks for confirmation when inserting a request file %s (%s)",
        async (_, relativeFolder, expectConfirmation) => {
            const directory = await createTemporaryDirectory({});
            jest.spyOn(window, "showErrorMessage").mockResolvedValue(undefined);
            const showWarningMessage = jest
                .spyOn(window, "showWarningMessage")
                .mockResolvedValue(undefined);

            await handleFileInsertion(
                {
                    getItemType: () => BrunoFileType.RequestFile,
                    getPath: () => join(directory, "missing.bru"),
                } as unknown as CollectionItem,
                {
                    insertionPosition: RequestFileInsertionPositionType.Folder,
                    newPath: join(directory, relativeFolder, "target.bru"),
                },
                createItemProviderStub<TypedCollectionItemProvider>(
                    directory,
                    CollectionFormat.Bru,
                ),
            );

            expect(showWarningMessage).toHaveBeenCalledTimes(
                expectConfirmation ? 1 : 0,
            );
        },
    );

    it("inserts a file that is not Bruno specific from outside of any collection", async () => {
        const directory = await createTemporaryDirectory({
            "shared/helper.js": "module.exports = {};",
            "collection/.keep": "",
        });
        const collectionDirectory = join(directory, "collection");
        const sourcePath = join(directory, "shared", "helper.js");
        const targetPath = join(collectionDirectory, "helper.js");
        const showErrorMessage = jest
            .spyOn(window, "showErrorMessage")
            .mockResolvedValue(undefined);
        const itemProvider =
            createItemProviderStub<TypedCollectionItemProvider>(
                collectionDirectory,
                CollectionFormat.Bru,
            );
        // Only the target is located in a collection.
        itemProvider.getAncestorCollectionForPath = (path: string) =>
            path.startsWith(collectionDirectory)
                ? createCollectionWithEnvironments(
                      [],
                      CollectionFormat.Bru,
                      collectionDirectory,
                  )
                : undefined;

        const result = await handleFileInsertion(
            new NonBrunoFile(sourcePath),
            {
                insertionPosition: RequestFileInsertionPositionType.Folder,
                newPath: targetPath,
            },
            itemProvider,
        );

        expect(result).toBe(true);
        expect(await readFile(targetPath, "utf-8")).toBe(
            "module.exports = {};",
        );
        expect(showErrorMessage).not.toHaveBeenCalled();
    });

    it.each([
        [true, 10, "copy"],
        [true, undefined, "0030_copy"],
        [false, 10, "0030_copy"],
    ])(
        "uses the name without the sequence prefix as the name of an inserted request if names are prefixed with sequences and the request has a sequence (setting: %s, sequence: %s)",
        async (prefixNames, sequence, expectedName) => {
            mockVsCodeSettings({
                "bru-as-code.prefixNamesWithSequence": prefixNames,
            });
            const directory = await createTemporaryDirectory({
                "0010_original.bru": `meta {\n  name: original\n  type: http\n${sequence === undefined ? "" : `  seq: ${sequence}\n`}}\n`,
            });
            const targetPath = join(directory, "0030_copy.bru");

            const result = await handleFileInsertion(
                new BrunoRequestFile(
                    join(directory, "0010_original.bru"),
                    sequence,
                ),
                {
                    insertionPosition: RequestFileInsertionPositionType.Folder,
                    newPath: targetPath,
                },
                createItemProviderStub<TypedCollectionItemProvider>(
                    directory,
                    CollectionFormat.Bru,
                ),
            );

            expect(result).toBe(true);
            expect(await readFile(targetPath, "utf-8")).toContain(
                `name: ${expectedName}\n`,
            );
        },
    );

    it("rejects a Bruno specific file from outside of any collection", async () => {
        const directory = await createTemporaryDirectory({});
        const showErrorMessage = jest
            .spyOn(window, "showErrorMessage")
            .mockResolvedValue(undefined);
        const itemProvider =
            createItemProviderStub<TypedCollectionItemProvider>(
                join(directory, "collection"),
                CollectionFormat.Bru,
            );
        itemProvider.getAncestorCollectionForPath = (path: string) =>
            path.startsWith(join(directory, "collection"))
                ? createCollectionWithEnvironments(
                      [],
                      CollectionFormat.Bru,
                      join(directory, "collection"),
                  )
                : undefined;

        const result = await handleFileInsertion(
            new BrunoRequestFile(join(directory, "shared", "request.bru")),
            {
                insertionPosition: RequestFileInsertionPositionType.Folder,
                newPath: join(directory, "collection", "request.bru"),
            },
            itemProvider,
        );

        expect(result).toBe(false);
        expect(showErrorMessage).toHaveBeenCalledTimes(1);
    });
});
