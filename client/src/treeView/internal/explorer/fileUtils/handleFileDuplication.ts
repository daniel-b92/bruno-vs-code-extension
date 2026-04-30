import {
    BrunoFileType,
    CollectionItem,
    getExtensionForBrunoFiles,
    getMaxSequenceForRequests,
    getSequenceForFile,
} from "@global_shared";
import {
    DialogOptionLabelEnum,
    TypedCollection,
    TypedCollectionItemProvider,
} from "@shared";
import { copyFile } from "fs";
import { basename, dirname } from "path";
import { promisify } from "util";
import { getPathForDuplicatedItem } from "../getPathForDuplicatedItem";
import { replaceNameInMetaBlock } from "./replaceNameInMetaBlock";
import { replaceSequenceForFile } from "./replaceSequenceForFile";
import { window } from "vscode";

export async function handleFileDuplication(
    item: CollectionItem,
    collection: TypedCollection,
    itemProvider: TypedCollectionItemProvider,
) {
    const itemType = item.getItemType();
    const originalPath = item.getPath();

    if (
        itemType != BrunoFileType.CollectionSettingsFile &&
        itemType != BrunoFileType.FolderSettingsFile
    ) {
        const newPath = await duplicateFile(
            collection,
            originalPath,
            itemProvider,
        );

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
            return await duplicateFile(collection, originalPath, itemProvider);
        }
    } else {
        const confirmed = await showWarningDialog(
            "Duplicate folder settings file?",
            "Only one folder settings file can be defined per folder.",
        );

        if (confirmed) {
            return await duplicateFile(collection, originalPath, itemProvider);
        }
    }
}

async function duplicateFile(
    collection: TypedCollection,
    originalPath: string,
    itemProvider: TypedCollectionItemProvider,
) {
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

    if (await getSequenceForFile(collection, originalPath)) {
        await replaceSequenceForFile(
            newPath,
            ((await getMaxSequenceForRequests(
                itemProvider,
                dirname(originalPath),
            )) ?? 0) + 1,
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
