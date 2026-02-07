import { dirname, resolve } from "path";
import {
    normalizeDirectoryPath,
    parseSequenceFromMetaBlock,
    filterAsync,
} from "@global_shared";
import {
    BrunoFileType,
    Collection,
    CollectionData,
    getItemType,
    isCollectionItemWithSequence,
    OutputChannelLogger,
} from "@shared";
import { lstat, readdir } from "fs/promises";
import { Event, Disposable } from "vscode";

export async function determineFilesToCheckWhetherInSync<T>(
    requestedFilePath: string,
    parentFolder: string,
    collection: Collection<T>,
    multiFileOperationData: {
        currentlyActive: (folder: string) => boolean;
        recentlyActive: (folder: string) => boolean;
        multiFileOperationFinishedNotifier: Event<string>;
    },
    cachedData: {
        getRegisteredItem: (
            collection: Collection<T>,
            path: string,
        ) => CollectionData<T> | undefined;
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

async function getRequestFilesFromFolderThatAreNotInSync<T>(
    folderPath: string,
    collection: Collection<T>,
    getRegisteredItem: (
        collection: Collection<T>,
        path: string,
    ) => CollectionData<T> | undefined,
) {
    const allItemsInFolder = await readdir(folderPath)
        .then((itemNames) => itemNames.map((name) => resolve(folderPath, name)))
        .catch(() => undefined);

    if (!allItemsInFolder) {
        return [];
    }

    const filesInFolder = await Promise.all(
        (
            await filterAsync(
                allItemsInFolder,
                async (path) =>
                    await lstat(path)
                        .then((stats) => stats.isFile())
                        .catch(() => false),
            )
        ).map(async (path) => ({
            path,
            sequence: await parseSequenceFromMetaBlock(path),
        })),
    );

    return await filterAsync(filesInFolder, async ({ path, sequence }) => {
        const registeredItem = getRegisteredItem(collection, path);

        return (
            (await getItemType(collection, path)) ==
                BrunoFileType.RequestFile &&
            (registeredItem == undefined ||
                (isCollectionItemWithSequence(registeredItem.item) &&
                    registeredItem.item.getSequence() !== sequence))
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
