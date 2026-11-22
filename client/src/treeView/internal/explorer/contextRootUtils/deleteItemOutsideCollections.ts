import { rm } from "fs/promises";
import { window } from "vscode";
import { BrunoTreeItem } from "@shared";
import { getDeleteConfirmationMessage } from "../getDeleteConfirmationMessage";
import { closeTabsRelatedToItem } from "../closeTabsRelatedToItem";
import { NonBrunoSpecificItemType } from "@global_shared";

/** Asks for confirmation and deletes the file or folder, without any logic that is specific to Bruno collections (e.g. for sequences). Returns whether the item was deleted. */
export async function deleteItemOutsideCollections(
    treeItem: BrunoTreeItem,
    confirmationOption: string,
) {
    const picked = await window.showInformationMessage(
        getDeleteConfirmationMessage(
            `${treeItem.label}`,
            treeItem.getPath(),
            treeItem.isFile
                ? NonBrunoSpecificItemType.OtherFileType
                : NonBrunoSpecificItemType.Directory,
        ),
        { modal: true },
        confirmationOption,
    );

    if (picked != confirmationOption) {
        return false;
    }

    try {
        await rm(treeItem.getPath(), { recursive: !treeItem.isFile });
    } catch {
        window.showErrorMessage(`An unexpected error occured.`);
        return false;
    }

    await closeTabsRelatedToItem(treeItem);

    return true;
}
