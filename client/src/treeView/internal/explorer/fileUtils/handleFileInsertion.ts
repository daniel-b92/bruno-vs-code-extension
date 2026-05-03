import {
    BrunoFileType,
    CollectionItem,
    doesFileNameMatchCollectionSettingsFile,
    doesFileNameMatchFolderSettingsFileName,
    getExtensionForBrunoFiles,
    isCollectionItemWithSequence,
    normalizePath,
} from "@global_shared";
import { DialogOptionLabelEnum, TypedCollectionItemProvider } from "@shared";
import { copyFile } from "fs";
import { basename, dirname } from "path";
import { promisify } from "util";
import { replaceNameInMetaBlock } from "./replaceNameInMetaBlock";
import { window } from "vscode";
import { updateSequencesAfterInsertingRequestFile } from "./updateSequencesAfterInsertingRequestFile";
import { FileInsertionPosition } from "./interfaces";

export async function handleFileInsertion(
    sourceItem: CollectionItem,
    target: {
        insertionPosition: FileInsertionPosition;
        newPath: string;
    },
    itemProvider: TypedCollectionItemProvider,
) {
    const { newPath } = target;
    const itemType = sourceItem.getItemType();

    if (
        itemType != BrunoFileType.CollectionSettingsFile &&
        itemType != BrunoFileType.FolderSettingsFile
    ) {
        const wasSuccessful = await insertFile(
            sourceItem,
            target,
            itemProvider,
        );

        await replaceNameInMetaBlock(
            newPath,
            basename(newPath).replace(getExtensionForBrunoFiles(), ""),
        );
        return wasSuccessful;
    }

    if (itemType == BrunoFileType.CollectionSettingsFile) {
        const shouldContinue =
            doesFileNameMatchCollectionSettingsFile(newPath) ||
            (await showWarningDialog(
                "Insert collection settings file?",
                `Only one collection settings file named 'collection${getExtensionForBrunoFiles()}' can be defined per collection.`,
            ));

        if (shouldContinue) {
            return await insertFile(sourceItem, target, itemProvider);
        }
    }

    if (itemType == BrunoFileType.CollectionSettingsFile) {
        const shouldContinue =
            doesFileNameMatchFolderSettingsFileName(newPath) ||
            (await showWarningDialog(
                "Insert folder settings file?",
                `Only one folder settings file named 'folder${getExtensionForBrunoFiles()}' can be defined per folder.`,
            ));

        if (shouldContinue) {
            return await insertFile(sourceItem, target, itemProvider);
        }
    }

    return false;
}

async function insertFile(
    sourceItem: CollectionItem,
    target: {
        insertionPosition: FileInsertionPosition;
        newPath: string;
    },
    itemProvider: TypedCollectionItemProvider,
) {
    const { newPath, insertionPosition } = target;

    if (
        await promisify(copyFile)(sourceItem.getPath(), newPath).catch(() => {
            window.showErrorMessage(`An unexpected error occured.`);
            return true;
        })
    ) {
        return false;
    }

    if (
        isCollectionItemWithSequence(sourceItem) &&
        sourceItem.getSequence() != undefined
    ) {
        const sourceItemDirectory = dirname(sourceItem.getPath());
        const targetDirectory = dirname(newPath);
        // Only if the source file has a sequence, sequences of requests may need to be adjusted.

        await updateSequencesAfterInsertingRequestFile(
            itemProvider,
            insertionPosition,
            newPath,
            {
                targetDirectory,
                otherDirectory:
                    normalizePath(sourceItemDirectory) ==
                    normalizePath(targetDirectory)
                        ? undefined
                        : sourceItemDirectory,
            },
        );
    }
    return true;
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
