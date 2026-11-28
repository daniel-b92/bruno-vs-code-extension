import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import {
    CancellationToken,
    commands,
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

    describe("normalizeSequences command", () => {
        it.each([
            { description: "another step", pickedStep: 10, messages: 1 },
            { description: "the configured step", pickedStep: 1, messages: 0 },
            { description: "no step", pickedStep: undefined, messages: 0 },
        ])(
            "offers $messages time(s) to save the step after picking $description",
            async ({ pickedStep, messages }) => {
                const directory = await createTemporaryDirectory({
                    "users/request.bru": requestContent(
                        CollectionFormat.Bru,
                        "request",
                        3,
                    ),
                });
                mockVsCodeSettings({});
                mockStepSelection(pickedStep);
                const showInformationMessage = jest.spyOn(
                    window,
                    "showInformationMessage",
                );
                const { runCommand } = createExplorer(directory, [
                    new CollectionDirectory(join(directory, "users")),
                    new BrunoRequestFile(
                        join(directory, "users", "request.bru"),
                        3,
                    ),
                ]);

                await runCommand("normalizeSequences", "users");

                expect(showInformationMessage).toHaveBeenCalledTimes(messages);
            },
        );
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
            const { drop } = createExplorer(directory, [
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
                const { drop } = createExplorer(directory, [
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
            const { drop } = createExplorer(directory, [
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

    describe("handleDrop with names without sequence prefixes", () => {
        it.each([
            FolderDropInsertionOption.InsertBeforeTarget,
            FolderDropInsertionOption.InsertAfterTarget,
        ])(
            "rejects moving a folder next to one with the same name for option '%s'",
            async (insertionOption) => {
                const directory = await createTemporaryDirectory({
                    "a/users/folder.bru": folderSettingsContent(
                        CollectionFormat.Bru,
                        "users",
                        2,
                    ),
                    "b/orders/folder.bru": folderSettingsContent(
                        CollectionFormat.Bru,
                        "orders",
                        1,
                    ),
                    "b/users/folder.bru": folderSettingsContent(
                        CollectionFormat.Bru,
                        "users",
                        2,
                    ),
                });
                const { applyEdit, showErrorMessage } = mockDialogsAndSettings(
                    insertionOption,
                    { prefixNamesWithSequence: false },
                );
                const { drop } = createExplorer(directory, [
                    new CollectionDirectory(join(directory, "a")),
                    new CollectionDirectory(join(directory, "b")),
                    createFolderItem(
                        join(directory, "a", "users"),
                        CollectionFormat.Bru,
                        2,
                    ),
                    createFolderItem(
                        join(directory, "b", "orders"),
                        CollectionFormat.Bru,
                        1,
                    ),
                    createFolderItem(
                        join(directory, "b", "users"),
                        CollectionFormat.Bru,
                        2,
                    ),
                ]);

                await drop(join("a", "users"), join("b", "orders"));

                expect(getShownMessages(showErrorMessage)).toEqual([
                    "Folder with name 'users' already exists in 'b'.",
                ]);
                expect(applyEdit).not.toHaveBeenCalled();
                expect(await readdir(join(directory, "a"))).toEqual(["users"]);
                expect((await readdir(join(directory, "b"))).sort()).toEqual([
                    "orders",
                    "users",
                ]);
            },
        );

        it("offers to insert next to a target folder with the sequence 0", async () => {
            const directory = await createTemporaryDirectory({
                "orders/folder.bru": folderSettingsContent(
                    CollectionFormat.Bru,
                    "orders",
                    0,
                ),
                "users/folder.bru": folderSettingsContent(
                    CollectionFormat.Bru,
                    "users",
                    2,
                ),
            });
            const { showInformationMessage } = mockDialogsAndSettings(
                FolderDropInsertionOption.InsertBeforeTarget,
                { prefixNamesWithSequence: false },
            );
            const { drop } = createExplorer(directory, [
                createFolderItem(
                    join(directory, "orders"),
                    CollectionFormat.Bru,
                    0,
                ),
                createFolderItem(
                    join(directory, "users"),
                    CollectionFormat.Bru,
                    2,
                ),
            ]);

            await drop("users", "orders");

            expect(showInformationMessage.mock.calls[0]).toContain(
                FolderDropInsertionOption.InsertBeforeTarget,
            );
        });
    });
});

/**
 * Confirms overwriting items and picks the given option when asked where to insert a folder.
 * Prefixing names with sequences is enabled unless `prefixNamesWithSequence` is set to `false`.
 */
function mockDialogsAndSettings(
    insertionOption = FolderDropInsertionOption.MoveIntoTargetAsSubfolder,
    { prefixNamesWithSequence = true } = {},
) {
    mockVsCodeSettings({
        "bru-as-code.prefixNamesWithSequence": prefixNamesWithSequence,
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
 * Returns functions for dragging and dropping one item onto another and for running a command on an item (all paths are relative to the directory).
 */
function createExplorer(directory: string, items: CollectionItem[]) {
    const registerCommand = jest.spyOn(commands, "registerCommand");
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

    const drop = async (sourcePath: string, targetPath: string) => {
        // The transfer items are passed on as they are set when dragging.
        const dataTransfer = new Map() as unknown as DataTransfer;
        const token = {} as CancellationToken;

        explorer.handleDrag([getTreeItem(sourcePath)], dataTransfer, token);
        await explorer.handleDrop(getTreeItem(targetPath), dataTransfer, token);
    };
    const runCommand = async (commandName: string, itemPath: string) => {
        const [, command] =
            registerCommand.mock.calls.find(([id]) =>
                id.endsWith(`.${commandName}`),
            ) ?? [];
        await (command as (item: BrunoTreeItem) => Promise<void>)(
            getTreeItem(itemPath),
        );
    };

    return { drop, runCommand };
}

/** Makes the quick pick for the sequence step return the given step, or be cancelled for `undefined`. */
function mockStepSelection(step: number | undefined) {
    let accept = () => {};
    let hide = () => {};
    jest.spyOn(window, "createQuickPick").mockReturnValue({
        onDidAccept: (listener: () => void) => (accept = listener),
        onDidHide: (listener: () => void) => (hide = listener),
        show() {
            if (step === undefined) {
                hide();
                return;
            }
            Object.assign(this, { activeItems: [{ value: step }] });
            accept();
        },
        hide: () => hide(),
        dispose: () => {},
    } as never);
}
