import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import {
    CancellationToken,
    DataTransfer,
    EventEmitter,
    Uri,
    window,
    workspace,
} from "vscode";
import {
    BrunoRequestFile,
    CollectionDirectory,
    CollectionFormat,
    CollectionItem,
    isCollectionItemWithSequence,
} from "@global_shared";
import {
    createCollectionWithItems,
    createFolderItem,
    folderSettingsContent,
    requestContent,
    runRequestBlock,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import {
    BrunoTreeItem,
    DialogOptionLabelEnum,
    FileSystemCacheSyncingHelper,
    TypedCollectionItemProvider,
} from "@shared";
import { applyWorkspaceEdit, mockVsCodeSettings } from "../../_testingUtils";
import { CollectionExplorer } from "./collectionExplorer";
import { getMessageForNameUsedBySibling } from "./explorer/validateEnteredName";
import { FolderDropInsertionOption } from "./explorer/folderDropInsertionOptionEnum";

describe("CollectionExplorer", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("handleDrop with names that are prefixed with sequences", () => {
        it("offers to overwrite a file with the same name", async () => {
            const directory = await createTemporaryDirectory({
                "a/00010_x.bru": requestContent(
                    CollectionFormat.Bru,
                    "x",
                    10,
                    runRequestBlock("moved"),
                ),
                "b/00010_x.bru": requestContent(CollectionFormat.Bru, "x", 10),
            });
            const { showInformationMessage, showErrorMessage } =
                mockDialogsAndSettings();
            const drop = createExplorer(directory, [
                new CollectionDirectory(join(directory, "a")),
                new CollectionDirectory(join(directory, "b")),
                new BrunoRequestFile(join(directory, "a", "00010_x.bru"), 10),
                new BrunoRequestFile(join(directory, "b", "00010_x.bru"), 10),
            ]);

            await drop(join("a", "00010_x.bru"), "b");

            expect(showErrorMessage).not.toHaveBeenCalled();
            expect(getShownMessages(showInformationMessage)).toContainEqual(
                expect.stringContaining("Do you want to overwrite it?"),
            );
            expect(await readdir(join(directory, "a"))).toEqual([]);
            expect(await readdir(join(directory, "b"))).toEqual([
                "00010_x.bru",
            ]);
            expect(
                await readFile(join(directory, "b", "00010_x.bru"), "utf-8"),
            ).toContain('runRequest("moved")');
        });

        it.each([
            { description: "without a sequence", targetSequence: undefined },
            { description: "with a sequence", targetSequence: 10 },
        ])(
            "offers to overwrite a folder with the same name in a target folder $description",
            async ({ targetSequence }) => {
                const directory = await createTemporaryDirectory({
                    "a/00010_users/moved.bru": requestContent(
                        CollectionFormat.Bru,
                        "moved",
                        10,
                    ),
                    "b/00010_users/replaced.bru": requestContent(
                        CollectionFormat.Bru,
                        "replaced",
                        10,
                    ),
                });
                const { showInformationMessage, showErrorMessage } =
                    mockDialogsAndSettings();
                const target = join(directory, "b");
                const drop = createExplorer(directory, [
                    new CollectionDirectory(join(directory, "a")),
                    targetSequence === undefined
                        ? new CollectionDirectory(target)
                        : createFolderItem(
                              target,
                              CollectionFormat.Bru,
                              targetSequence,
                          ),
                    new CollectionDirectory(
                        join(directory, "a", "00010_users"),
                    ),
                    new CollectionDirectory(
                        join(directory, "b", "00010_users"),
                    ),
                ]);

                await drop(join("a", "00010_users"), "b");

                expect(showErrorMessage).not.toHaveBeenCalled();
                expect(getShownMessages(showInformationMessage)).toContainEqual(
                    expect.stringContaining("Do you want to overwrite it?"),
                );
                expect(await readdir(join(directory, "a"))).toEqual([]);
                const [movedFolder, ...others] = await readdir(target);
                expect(others).toEqual([]);
                expect(await readdir(join(target, movedFolder))).toContain(
                    "moved.bru",
                );
                expect(await readdir(join(target, movedFolder))).not.toContain(
                    "replaced.bru",
                );
            },
        );

        it("rejects inserting a folder next to one with the same name", async () => {
            const directory = await createTemporaryDirectory({
                "a/00010_users/folder.bru": folderSettingsContent(
                    CollectionFormat.Bru,
                    "users",
                    10,
                ),
                "b/00010_users/folder.bru": folderSettingsContent(
                    CollectionFormat.Bru,
                    "users",
                    10,
                ),
                "b/00020_other/folder.bru": folderSettingsContent(
                    CollectionFormat.Bru,
                    "other",
                    20,
                ),
            });
            const { applyEdit, showErrorMessage } = mockDialogsAndSettings(
                FolderDropInsertionOption.InsertBeforeTarget,
            );
            const drop = createExplorer(directory, [
                new CollectionDirectory(join(directory, "a")),
                new CollectionDirectory(join(directory, "b")),
                ...[
                    { path: join("a", "00010_users"), sequence: 10 },
                    { path: join("b", "00010_users"), sequence: 10 },
                    { path: join("b", "00020_other"), sequence: 20 },
                ].map(({ path, sequence }) =>
                    createFolderItem(
                        join(directory, path),
                        CollectionFormat.Bru,
                        sequence,
                    ),
                ),
            ]);

            await drop(join("a", "00010_users"), join("b", "00020_other"));

            expect(getShownMessages(showErrorMessage)).toEqual([
                `${getMessageForNameUsedBySibling("users")} in 'b'.`,
            ]);
            expect(applyEdit).not.toHaveBeenCalled();
        });
    });
});

/** Confirms overwriting items and picks the given option when asked where to insert a folder. */
function mockDialogsAndSettings(
    insertionOption = FolderDropInsertionOption.MoveIntoTargetAsSubfolder,
) {
    mockVsCodeSettings({
        "bru-as-code.prefixNamesWithSequence": true,
        "bru-as-code.sequenceStep": 10,
    });
    return {
        applyEdit: jest
            .spyOn(workspace, "applyEdit")
            .mockImplementation(applyWorkspaceEdit),
        showInformationMessage: jest
            .spyOn(window, "showInformationMessage")
            .mockImplementation((async (message: string) =>
                message.includes("overwrite")
                    ? DialogOptionLabelEnum.Confirm
                    : insertionOption) as never),
        showErrorMessage: jest.spyOn(window, "showErrorMessage"),
    };
}

function getShownMessages(dialogSpy: { mock: { calls: unknown[][] } }) {
    return dialogSpy.mock.calls.map(([message]) => message);
}

/**
 * Creates a collection explorer for a Bru collection with the given items.
 * Returns a function that drags and drops one item onto another (both paths are relative to the directory).
 */
function createExplorer(directory: string, items: CollectionItem[]) {
    jest.replaceProperty(workspace, "workspaceFolders", [
        { uri: Uri.file(directory), name: "workspace", index: 0 },
    ]);
    const { collection, itemProvider } = createCollectionWithItems<object>(
        items,
        CollectionFormat.Bru,
        [],
        directory,
    );
    collection.getAllStoredDataForCollection().forEach((data) => {
        const { item } = data;
        data.additionalData = {
            treeItem: new BrunoTreeItem(
                item.getPath(),
                item.isFile(),
                false,
                isCollectionItemWithSequence(item)
                    ? item.getSequence()
                    : undefined,
            ),
        };
    });
    const explorer = new CollectionExplorer(
        Object.assign(itemProvider, {
            getRegisteredItem: (_collection: unknown, path: string) =>
                collection.getStoredDataForPath(path),
            subscribeToUpdates: () => {},
            subscribeToAdditionalContextRootChanges: () => {},
        }) as unknown as TypedCollectionItemProvider,
        {} as FileSystemCacheSyncingHelper,
        new EventEmitter(),
    );
    const getTreeItem = (relativePath: string) =>
        collection.getStoredDataForPath(join(directory, relativePath))
            ?.additionalData.treeItem as BrunoTreeItem;

    return async (sourcePath: string, targetPath: string) => {
        // The transfer items are passed on as they are set when dragging.
        const dataTransfer = new Map() as unknown as DataTransfer;
        const token = {} as CancellationToken;

        explorer.handleDrag([getTreeItem(sourcePath)], dataTransfer, token);
        await explorer.handleDrop(getTreeItem(targetPath), dataTransfer, token);
    };
}
