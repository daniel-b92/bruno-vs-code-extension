import { promisify } from "util";
import {
    AdditionalCollectionDataProviderParamType,
    AdditionalCollectionDataProvider,
    Collection,
    CollectionData,
    CollectionDirectory,
    CollectionItem,
    getSequenceForFolder,
    getFolderSettingsFilePath,
    parseBruFile,
    TextDocumentHelper,
    getSequenceFieldFromMetaBlock,
    RequestFileBlockName,
    getSequenceValueFromMetaBlock,
} from "../..";
import { getCollectionFile } from "./getCollectionFile";
import { isModifiedItemOutdated } from "./isModifiedItemOutdated";
import { readFile } from "fs";

export async function addItemToCollection<T>(params: {
    isDirectory: boolean;
    path: string;
    collection: Collection<T>;
    additionalCollectionDataProviders: AdditionalCollectionDataProvider<T>;
}) {
    const { additionalCollectionDataProviders, collection, isDirectory, path } =
        params;

    const item = isDirectory
        ? new CollectionDirectory(
              path,
              await getSequenceForFolder(collection.getRootDirectory(), path),
          )
        : await getCollectionFile(collection, path);

    if (!item) {
        return;
    }

    const data: CollectionData<T> = {
        item,
        additionalData,
    };

    const registeredDataWithSamePath = collection.getStoredDataForPath(
        item.getPath(),
    );

    if (!registeredDataWithSamePath) {
        collection.addItem(data);
        return data;
    }

    handleAlreadyRegisteredItemWithSamePath(
        collection,
        registeredDataWithSamePath,
        data,
    );
    return data;
}

async function getCollectionData<T>(params: {
    isDirectory: boolean;
    path: string;
    collection: Collection<T>;
    additionalDataProvider: AdditionalCollectionDataProvider<T>;
}): Promise<CollectionData<T> | undefined> {
    const { additionalDataProvider, collection, isDirectory, path } = params;

    if (
        additionalDataProvider.paramType ==
        AdditionalCollectionDataProviderParamType.CollectionItem
    ) {
        const item = isDirectory
            ? new CollectionDirectory(
                  path,
                  await getSequenceForFolder(
                      collection.getRootDirectory(),
                      path,
                  ),
              )
            : await getCollectionFile(collection, path);

        return item
            ? { item, additionalData: additionalDataProvider.callback(item) }
            : undefined;
    }

    if (isDirectory) {
        const folderSettingsFile = await getFolderSettingsFilePath(path);
        const folderSettingsFileContent = folderSettingsFile
            ? await promisify(readFile)(folderSettingsFile, "utf-8").catch(
                  () => undefined,
              )
            : undefined;

        if (!folderSettingsFileContent) {
            return undefined;
        }

        const parsedSettingsFile = parseBruFile(
            new TextDocumentHelper(folderSettingsFileContent),
        );
        const metaBlocks = parsedSettingsFile.blocks.filter(
            ({ name }) => name == RequestFileBlockName.Meta,
        );
        const sequence =
            metaBlocks.length == 1
                ? getSequenceValueFromMetaBlock(metaBlocks[0])
                : undefined;

        return {
            item: new CollectionDirectory(path, sequence),
            additionalData: additionalDataProvider.callback(parsedSettingsFile),
        };
    }

    return {
        item: await getCollectionFile(collection, path)
        additionalData: additionalDataProvider.callback(parsedSettingsFile),
    };
}

function handleAlreadyRegisteredItemWithSamePath<T>(
    collection: Collection<T>,
    { item: alreadyRegisteredItem }: CollectionData<T>,
    newData: CollectionData<T>,
) {
    if (
        isModifiedItemOutdated(alreadyRegisteredItem, newData.item).isOutdated
    ) {
        collection.removeTestItemIfRegistered(alreadyRegisteredItem.getPath());
        collection.addItem(newData);
    }
}
