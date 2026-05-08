import {
    BrunoFileType,
    CollectionItem,
    doesFileNameMatchCollectionSettingsFile,
    doesFileNameMatchFolderSettingsFileName,
    getExtensionForBrunoFiles,
    isCollectionItemWithSequence,
    isInFolderForEnvironmentFiles,
    ItemType,
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
import { writeFile } from "fs/promises";

export async function handleFileInsertion(
    sourceItem: CollectionItem,
    target: {
        insertionPosition: FileInsertionPosition;
        newPath: string;
    },
    itemProvider: TypedCollectionItemProvider,
    newContent?: string,
) {
    const { newPath } = target;
    const itemType = sourceItem.getItemType();

    const shouldContinue = await requestConfirmationIfNeeded(itemType, newPath);

    if (!shouldContinue) {
        return false;
    }

    const wasSuccessful = await insertFile(
        sourceItem,
        target,
        itemProvider,
        newContent,
    );

    if (itemType == BrunoFileType.RequestFile) {
        await replaceNameInMetaBlock(
            newPath,
            basename(newPath).replace(getExtensionForBrunoFiles(), ""),
        );
    }

    return wasSuccessful;
}

async function requestConfirmationIfNeeded(
    itemType: ItemType,
    newPath: string,
) {
    if (itemType == BrunoFileType.EnvironmentFile) {
        return (
            isInFolderForEnvironmentFiles(newPath) ||
            (await showWarningDialog(
                "Insert environment file?",
                `Environment files are only valid within the 'environments' folder.`,
            ))
        );
    }

    if (isInFolderForEnvironmentFiles(newPath)) {
        return await showWarningDialog(
            `Insert file of type '${itemType}'?`,
            `In the 'environments' folder only environment files are valid.`,
        );
    }

    if (itemType == BrunoFileType.FolderSettingsFile) {
        return (
            doesFileNameMatchFolderSettingsFileName(newPath) ||
            (await showWarningDialog(
                "Insert folder settings file?",
                `Only one folder settings file named 'folder${getExtensionForBrunoFiles()}' can be defined per folder.`,
            ))
        );
    }

    if (itemType == BrunoFileType.CollectionSettingsFile) {
        return (
            doesFileNameMatchCollectionSettingsFile(newPath) ||
            (await showWarningDialog(
                "Insert collection settings file?",
                `Only one collection settings file named 'collection${getExtensionForBrunoFiles()}' can be defined per collection.`,
            ))
        );
    }

    return true;
}

async function insertFile(
    sourceItem: CollectionItem,
    target: {
        insertionPosition: FileInsertionPosition;
        newPath: string;
    },
    itemProvider: TypedCollectionItemProvider,
    newContent?: string,
) {
    const { newPath, insertionPosition } = target;

    if (
        newContent === undefined &&
        (await promisify(copyFile)(sourceItem.getPath(), newPath).catch(() => {
            window.showErrorMessage(`An unexpected error occured.`);
            return true;
        }))
    ) {
        return false;
    }

    if (
        newContent !== undefined &&
        (await writeFile(newPath, newContent).catch(() => {
            window.showErrorMessage(`An unexpected error occured.`);
            return true;
        }))
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
