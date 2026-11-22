import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { join } from "path";
import { window, TabInputText, Uri } from "vscode";
import { checkIfPathExistsAsync } from "@global_shared";
import { useTemporaryDirectories } from "@global_shared/_testingUtils";
import { BrunoTreeItem } from "@shared";
import { deleteItemOutsideCollections } from "./deleteItemOutsideCollections";

const confirmation = "Confirm";

describe("deleteItemOutsideCollections", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("deletes a folder with its content and closes its tabs after confirmation", async () => {
        const directory = await createTemporaryDirectory({
            "folder/sub/a.js": "",
        });
        const folderPath = join(directory, "folder");
        const showInformationMessage = mockConfirmation(confirmation);
        const closedTabs = mockOpenTabs([join(folderPath, "sub", "a.js")]);

        const result = await deleteItemOutsideCollections(
            new BrunoTreeItem(folderPath, false, false),
            confirmation,
        );

        expect(result).toBe(true);
        expect(await checkIfPathExistsAsync(folderPath)).toBe(false);
        expect(showInformationMessage.mock.calls[0][0]).toBe(
            "Delete 'folder'?",
        );
        expect(closedTabs).toHaveLength(1);
    });

    it("deletes a file after confirmation", async () => {
        const directory = await createTemporaryDirectory({ "a.js": "" });
        mockConfirmation(confirmation);
        mockOpenTabs([]);

        const result = await deleteItemOutsideCollections(
            new BrunoTreeItem(join(directory, "a.js"), true, false),
            confirmation,
        );

        expect(result).toBe(true);
        expect(await checkIfPathExistsAsync(join(directory, "a.js"))).toBe(
            false,
        );
    });

    it("keeps the item when the confirmation was dismissed", async () => {
        const directory = await createTemporaryDirectory({ "a.js": "" });
        mockConfirmation(undefined);

        const result = await deleteItemOutsideCollections(
            new BrunoTreeItem(join(directory, "a.js"), true, false),
            confirmation,
        );

        expect(result).toBe(false);
        expect(await checkIfPathExistsAsync(join(directory, "a.js"))).toBe(
            true,
        );
    });
});

function mockConfirmation(pickedOption: string | undefined) {
    return jest
        .spyOn(window, "showInformationMessage")
        .mockResolvedValue(pickedOption as never);
}

/** Returns the list of tabs that were closed. */
function mockOpenTabs(openPaths: string[]) {
    const closedTabs: unknown[] = [];
    jest.replaceProperty(window.tabGroups, "all", [
        {
            tabs: openPaths.map((path) => ({
                input: new TabInputText(Uri.file(path)),
            })),
        },
    ] as never);
    jest.spyOn(window.tabGroups, "close").mockImplementation((tabs) => {
        closedTabs.push(...(tabs as unknown[]));
        return Promise.resolve(true);
    });

    return closedTabs;
}
