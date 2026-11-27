import { dirname } from "path";
import {
    BrunoFileType,
    checkIfPathExistsAsync,
    ItemType,
    NonBrunoSpecificItemType,
} from "@global_shared";
import {
    getSequenceStepFromSettings,
    OutputChannelLogger,
    shouldRenumberSequencesAutomatically,
    TypedCollectionItemProvider,
} from "@shared";
import { normalizeSequencesForRequestsAndAppFiles } from "./fileUtils/normalizeSequencesForRequestsAndAppFiles";
import { normalizeSequencesForFolders } from "./folderUtils/normalizeSequencesForFolders";
import { SequencesByPath } from "./sequencePrefixUtils/getSequencesBeforeChange";
import { syncSequencePrefixes } from "./sequencePrefixUtils/syncSequencePrefixes";

/** The data of a deleted item, as it was before its deletion. */
export interface DeletedItemData {
    path: string;
    itemType: ItemType;
    sequence: number | undefined;
}

/**
 * Renumbers the remaining items after a file or folder has been deleted.
 * Unless renumbering is enabled in the settings, the sequences of the remaining items are kept.
 */
export async function updateSequencesAfterDeletingItem(
    itemProvider: TypedCollectionItemProvider,
    deletedItem: DeletedItemData,
    /** The folder whose direct child items may be affected by the deletion. */
    parentFolder: string | undefined,
    /** See `getSequencesBeforeChange`. */
    previousSequences: SequencesByPath,
    logger?: OutputChannelLogger,
) {
    const { path, itemType, sequence } = deletedItem;

    if (
        !shouldRenumberSequencesAutomatically() ||
        !parentFolder ||
        !(await checkIfPathExistsAsync(dirname(path)))
    ) {
        return;
    }

    const sequenceStep = getSequenceStepFromSettings();

    if (
        itemType == BrunoFileType.RequestFile ||
        itemType == BrunoFileType.AppFile
    ) {
        await normalizeSequencesForRequestsAndAppFiles(
            itemProvider,
            dirname(path),
            sequenceStep,
        );
    } else if (
        itemType == BrunoFileType.FolderSettingsFile ||
        (itemType == NonBrunoSpecificItemType.Directory &&
            sequence !== undefined)
    ) {
        await normalizeSequencesForFolders(
            itemProvider,
            parentFolder,
            sequenceStep,
        );
    } else {
        return;
    }

    await syncSequencePrefixes(itemProvider, [parentFolder], {
        logger,
        previousSequences,
    });
}
