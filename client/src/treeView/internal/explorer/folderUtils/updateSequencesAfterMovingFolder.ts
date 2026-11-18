import { basename, dirname, resolve } from "path";
import { getFolderSettingsFilePath } from "@global_shared";
import {
    getMaxSequenceForFolders,
    getSequencesForFolders,
    TypedCollectionItemProvider,
    BrunoTreeItem,
} from "@shared";
import { replaceSequenceForFile } from "../fileUtils/replaceSequenceForFile";
import { normalizeSequencesForFolders } from "./normalizeSequencesForFolders";
import { window } from "vscode";
import { FolderDropInsertionOption } from "../folderDropInsertionOptionEnum";
import { showErrorMessageForFailedDragAndDrop } from "../showErrorMessageForFailedDragAndDrop";
import { setSequenceForFolder } from "./setSequenceForFolder";

export async function updateSequencesAfterMovingFolder(
    itemProvider: TypedCollectionItemProvider,
    sourcePath: string,
    target: BrunoTreeItem,
    insertionOption: FolderDropInsertionOption,
) {
    const collection = itemProvider.getAncestorCollectionForPath(sourcePath);

    if (!collection) {
        window.showErrorMessage(
            `Could not determine the collection for the folder '${sourcePath}'.`,
        );
        return;
    }

    const format = collection.getFormat();

    if (
        insertionOption == FolderDropInsertionOption.MoveIntoTargetAsSubfolder
    ) {
        const parentFolder = target.getPath();
        const newFolderPath = resolve(parentFolder, basename(sourcePath));

        const newSequence =
            1 +
            ((await getMaxSequenceForFolders(itemProvider, parentFolder)) ?? 0);

        if (!(await setSequenceForFolder(newFolderPath, newSequence, format))) {
            showErrorMessageForFailedDragAndDrop(sourcePath);
            return;
        }

        await normalizeSequencesForFolders(itemProvider, parentFolder);
        await normalizeSequencesForFolders(itemProvider, dirname(sourcePath));
        return;
    }

    const parentFolder = dirname(target.getPath());
    // The folder has already been moved, so `sourcePath` is only its old path (which can be in a different parent folder).
    const newFolderPath = resolve(parentFolder, basename(sourcePath));

    const newSequence =
        insertionOption == FolderDropInsertionOption.InsertBeforeTarget
            ? (target.getSequence() as number)
            : (target.getSequence() as number) + 1;

    if (!(await setSequenceForFolder(newFolderPath, newSequence, format))) {
        showErrorMessageForFailedDragAndDrop(sourcePath);
        return;
    }

    const filtered = (
        await getSequencesForFolders(itemProvider, parentFolder)
    ).filter(
        ({ folderPath, sequence }) =>
            folderPath != sourcePath &&
            folderPath != newFolderPath &&
            sequence >= newSequence,
    );

    for (const { folderPath, sequence: initialSequence } of filtered) {
        await replaceSequenceForFile(
            (await getFolderSettingsFilePath(
                false,
                folderPath,
                format,
            )) as string,
            initialSequence + 1,
        );
    }

    await normalizeSequencesForFolders(itemProvider, parentFolder);
}
