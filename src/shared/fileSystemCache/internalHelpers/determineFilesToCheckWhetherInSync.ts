import { dirname, resolve } from "path";
import {
    BrunoFileType,
    Collection,
    CollectionData,
    filterAsync,
    getFileType,
    normalizeDirectoryPath,
    OutputChannelLogger,
    parseSequenceFromMetaBlock,
} from "../..";
import { lstat, readdir } from "fs/promises";
import { Event, Disposable } from "vscode";

export async function determineFilesToCheckWhetherInSync(
    requestedFilePath: string,
    parentFolder: string,
    collection: Collection,
    multiFileOperationData: {
        currentlyActive: (folder: string) => boolean;
        recentlyActive: (folder: string) => boolean;
        multiFileOperationFinishedNotifier: Event<string>;
    },
    cachedData: {
        getRegisteredItem: (
            collection: Collection,
            path: string,
        ) => CollectionData | undefined;
    },
    logger?: OutputChannelLogger,
) {
    const {
        currentlyActive: isMultiFileOperationActive,
        recentlyActive: hasMultiFileOperationRecentlyBeenActive,
        multiFileOperationFinishedNotifier,
    } = multiFileOperationData;
    const { getRegisteredItem } = cachedData;

    if (!hasMultiFileOperationRecentlyBeenActive(parentFolder)) {
        const sequence = await parseSequenceFromMetaBlock(requestedFilePath);
        return [{ path: requestedFilePath, sequence }];
    }

    if (isMultiFileOperationActive(parentFolder)) {
        logger?.debug(
            `Waiting for multi file operation in folder '${parentFolder}' to finish before items in cache will be checked.`,
        );

        await waitForActiveMultiFileOperationToFinish(
            dirname(requestedFilePath),
            multiFileOperationFinishedNotifier,
            logger,
        );
    }

    return await getRequestFilesFromFolderThatAreNotInSync(
        parentFolder,
        collection,
        getRegisteredItem,
    );
}

async function getRequestFilesFromFolderThatAreNotInSync(
    folderPath: string,
    collection: Collection,
    getRegisteredItem: (
        collection: Collection,
        path: string,
    ) => CollectionData | undefined,
) {
    const allItemsInFolder = (await readdir(folderPath)).map((name) =>
        resolve(folderPath, name),
    );

    const filesInFolder = await Promise.all(
        (
            await filterAsync(allItemsInFolder, async (path) =>
                (await lstat(path)).isFile(),
            )
        ).map(async (path) => ({
            path,
            sequence: await parseSequenceFromMetaBlock(path),
        })),
    );

    return await filterAsync(filesInFolder, async ({ path, sequence }) => {
        const registeredItem = getRegisteredItem(collection, path);

        return (
            (await getFileType(collection, path)) ==
                BrunoFileType.RequestFile &&
            (registeredItem == undefined ||
                registeredItem.item.getSequence() !== sequence)
        );
    });
}

async function waitForActiveMultiFileOperationToFinish(
    folderPath: string,
    multiFileOperationFinishedNotifier: Event<string>,
    logger?: OutputChannelLogger,
) {
    let subscription: Disposable | undefined = undefined;

    await new Promise<void>((resolve) => {
        subscription = multiFileOperationFinishedNotifier((f) => {
            if (normalizeDirectoryPath(folderPath) == normalizeDirectoryPath(f))
                logger?.debug(`Multi file operation completed.`);
            resolve();
        });
    });

    if (subscription) {
        (subscription as Disposable).dispose();
    }
}
