import { basename, resolve } from "path";
import {
    CollectionItemProvider,
    getFolderSettingsFilePath,
    getMaxSequenceForFolders,
} from "../../../shared";
import { BrunoTreeItem } from "../../brunoTreeItem";
import { replaceSequenceForFile } from "./replaceSequenceForFile";
import { normalizeSequencesForFolders } from "./normalizeSequencesForFolders";
import { window } from "vscode";

export function updateSequencesAfterMovingFolder(
    itemProvider: CollectionItemProvider,
    target: BrunoTreeItem,
    sourcePath: string
) {
    const parentFolder = target.getPath();
    const newFolderPath = resolve(parentFolder, basename(sourcePath));
    const newFolderSettingsFile = getFolderSettingsFilePath(newFolderPath);

    // ToDo: Check if the drag and drop target can be a file when moving a folder
    const newSequence =
        1 + (getMaxSequenceForFolders(itemProvider, parentFolder) ?? 0);

    if (!newFolderSettingsFile) {
        window.showErrorMessage(
            `An unexpected error occured while trying to find the folder settings file for the folder '${newFolderPath}'`
        );
        return;
    }

    replaceSequenceForFile(newFolderSettingsFile, newSequence);
    normalizeSequencesForFolders(itemProvider, parentFolder);
}
