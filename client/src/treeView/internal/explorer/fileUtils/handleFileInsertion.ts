import {
    BrunoFileType,
    CollectionItem,
    doesFileNameMatchCollectionSettingsFile,
    doesFileNameMatchFolderSettingsFileName,
    getFileExtensionForFormat,
    getFolderSettingsFileName,
    getStoredItemNameFromFile,
    getCollectionSettingsFileName,
    isCollectionItemWithSequence,
    isBrunoFileType,
    isInEnvironmentsFolderOfCollection,
    ItemType,
    normalizePath,
    parseSequenceFromFile,
    ReadyOnlyCollection,
} from "@global_shared";
import { DialogOptionLabelEnum, TypedCollectionItemProvider } from "@shared";
import { copyFile } from "fs";
import { basename, dirname } from "path";
import { promisify } from "util";
import { replaceItemName } from "./replaceItemName";
import { window } from "vscode";
import { updateSequencesAfterInsertingRequestOrAppFile } from "./updateSequencesAfterInsertingRequestOrAppFile";
import { FileInsertionPosition } from "./interfaces";
import { writeFile } from "fs/promises";
import { getStoredNameForCopiedItem } from "../sequencePrefixUtils/getStoredNameForCopiedItem";

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
    const targetCollection = itemProvider.getAncestorCollectionForPath(newPath);

    if (!targetCollection) {
        window.showErrorMessage(
            `Could not determine the collection for path '${newPath}'.`,
        );
        return false;
    }

    const sourceCollection = itemProvider.getAncestorCollectionForPath(
        sourceItem.getPath(),
    );

    // Files that are not Bruno specific (e.g. from an additional context root) can also be inserted from outside of any collection.
    if (!sourceCollection && isBrunoFileType(itemType)) {
        window.showErrorMessage(
            `Could not determine the collection for path '${sourceItem.getPath()}'.`,
        );
        return false;
    }

    const format = targetCollection.getFormat();

    // TODO: Support copying/moving items between collections with different formats (Bru <-> Yaml).
    // This would require converting the file content and adjusting the file extension.
    if (sourceCollection && sourceCollection.getFormat() != format) {
        window.showErrorMessage(
            `Inserting files between collections with different formats (Bru and Yaml) is not supported.`,
        );
        return false;
    }

    const shouldContinue = await requestConfirmationIfNeeded(
        itemType,
        newPath,
        targetCollection,
    );

    if (!shouldContinue) {
        return false;
    }

    const wasSuccessful = await insertFile(
        sourceItem,
        target,
        itemProvider,
        newContent,
    );

    if (wasSuccessful && itemType == BrunoFileType.RequestFile) {
        await replaceItemName(
            newPath,
            getStoredNameForCopiedItem(
                basename(newPath).replace(
                    getFileExtensionForFormat(format),
                    "",
                ),
                {
                    name: basename(
                        sourceItem.getPath(),
                        getFileExtensionForFormat(format),
                    ),
                    sequence: isCollectionItemWithSequence(sourceItem)
                        ? sourceItem.getSequence()
                        : undefined,
                    // The inserted file still has the content of the source file, which may have been changed since it was copied.
                    storedName: await getStoredItemNameFromFile(newPath),
                },
            ),
            itemType,
            format,
        );
    }

    return wasSuccessful;
}

async function requestConfirmationIfNeeded(
    itemType: ItemType,
    newPath: string,
    targetCollection: ReadyOnlyCollection<unknown>,
) {
    const format = targetCollection.getFormat();
    const isInEnvironmentsFolder = isInEnvironmentsFolderOfCollection(
        targetCollection,
        newPath,
    );

    if (itemType == BrunoFileType.EnvironmentFile) {
        return (
            isInEnvironmentsFolder ||
            (await showWarningDialog(
                "Insert environment file?",
                `Environment files are only valid within the 'environments' folder.`,
            ))
        );
    }

    if (isInEnvironmentsFolder) {
        return await showWarningDialog(
            `Insert file of type '${itemType}'?`,
            `In the 'environments' folder only environment files are valid.`,
        );
    }

    if (itemType == BrunoFileType.FolderSettingsFile) {
        return (
            doesFileNameMatchFolderSettingsFileName(newPath, format) ||
            (await showWarningDialog(
                "Insert folder settings file?",
                `Only one folder settings file named '${getFolderSettingsFileName(format)}' can be defined per folder.`,
            ))
        );
    }

    if (itemType == BrunoFileType.CollectionSettingsFile) {
        return (
            doesFileNameMatchCollectionSettingsFile(newPath, format) ||
            (await showWarningDialog(
                "Insert collection settings file?",
                `Only one collection settings file named '${getCollectionSettingsFileName(format)}' can be defined per collection.`,
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
    const itemType = sourceItem.getItemType();
    const isRequestOrAppFile =
        itemType == BrunoFileType.RequestFile ||
        itemType == BrunoFileType.AppFile;
    // Has to be read before an existing file is overwritten.
    const replacedSequence = isRequestOrAppFile
        ? await parseSequenceFromFile(newPath)
        : undefined;

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
        isRequestOrAppFile &&
        (replacedSequence !== undefined ||
            (isCollectionItemWithSequence(sourceItem) &&
                sourceItem.getSequence() != undefined))
    ) {
        const sourceItemDirectory = dirname(sourceItem.getPath());
        const targetDirectory = dirname(newPath);
        // Only if the source or the overwritten file has a sequence, sequences of requests and app files may need to be adjusted.

        await updateSequencesAfterInsertingRequestOrAppFile(
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
            replacedSequence,
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
