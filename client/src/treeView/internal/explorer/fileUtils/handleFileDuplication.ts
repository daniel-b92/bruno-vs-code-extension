import {
    BrunoFileType,
    getExtensionForBrunoFiles,
    ItemType,
} from "@global_shared";
import {
    DialogOptionLabelEnum,
    TypedCollectionData,
    TypedCollectionItemProvider,
} from "@shared";
import { copyFile } from "fs";
import { basename, dirname } from "path";
import { promisify } from "util";
import { getPathForDuplicatedItem } from "../getPathForDuplicatedItem";
import { replaceNameInMetaBlock } from "./replaceNameInMetaBlock";
import { window } from "vscode";
import { updateSequencesAfterMovingRequestFile } from "./updateSequencesAfterMovingRequestFile";
import { BrunoTreeItem } from "../../../brunoTreeItem";

export async function handleFileDuplication(
    { item, additionalData: { treeItem } }: TypedCollectionData,
    itemProvider: TypedCollectionItemProvider,
) {
    const itemType = item.getItemType();

    if (
        itemType != BrunoFileType.CollectionSettingsFile &&
        itemType != BrunoFileType.FolderSettingsFile
    ) {
        const newPath = await duplicateFile(itemType, treeItem, itemProvider);

        if (newPath === undefined) {
            return undefined;
        }

        await replaceNameInMetaBlock(
            newPath,
            basename(newPath).replace(getExtensionForBrunoFiles(), ""),
        );
        return newPath;
    } else if (itemType == BrunoFileType.CollectionSettingsFile) {
        const confirmed = await showWarningDialog(
            "Duplicate collection settings file?",
            "Only one collection settings file can be defined per collection.",
        );

        if (confirmed) {
            return await duplicateFile(itemType, treeItem, itemProvider);
        }
    } else {
        const confirmed = await showWarningDialog(
            "Duplicate folder settings file?",
            "Only one folder settings file can be defined per folder.",
        );

        if (confirmed) {
            return await duplicateFile(itemType, treeItem, itemProvider);
        }
    }
}

async function duplicateFile(
    itemType: ItemType,
    sourceItem: BrunoTreeItem,
    itemProvider: TypedCollectionItemProvider,
) {
    const originalPath = sourceItem.getPath();
    const newPath = await getPathForDuplicatedItem(originalPath);

    if (
        !newPath ||
        (await promisify(copyFile)(originalPath, newPath).catch(() => {
            window.showErrorMessage(`An unexpected error occured.`);
            return true;
        }))
    ) {
        return undefined;
    }

    if (
        itemType == BrunoFileType.RequestFile &&
        sourceItem.getSequence() != undefined
    ) {
        // Only when duplicating a request file, sequences of requests may need to be adjusted
        await updateSequencesAfterMovingRequestFile(
            itemProvider,
            sourceItem,
            dirname(originalPath),
            newPath,
        );
    }

    return newPath;
}

async function showWarningDialog(modalMessage: string, detailText: string) {
    const picked = await window.showWarningMessage(
        modalMessage,
        {
            modal: true,
            detail: detailText,
        },
        DialogOptionLabelEnum.Confirm,
    );

    return picked == DialogOptionLabelEnum.Confirm;
}
