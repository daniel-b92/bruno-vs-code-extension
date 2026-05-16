import { promisify } from "util";
import {
    AdditionalCollectionDataProviderType,
    AdditionalCollectionDataProvider,
    Collection,
    CollectionData,
    parseBruFile,
    TextDocumentHelper,
    getItemType,
} from "../..";
import { getCollectionItem } from "./getCollectionItem";
import { isModifiedItemOutdated } from "./isModifiedItemOutdated";
import { readFile } from "fs";
import { FileSystemData } from "./interfaces";
import { getFileSystemDataPath } from "./fileSystemDataUtils";

export async function addOrReplaceItemInCollection<T>(newItem: {
    fileSystemData: FileSystemData;
    collection: Collection<T>;
    additionalDataProvider: AdditionalCollectionDataProvider<T>;
}) {
    const { additionalDataProvider, collection, fileSystemData } = newItem;

    const data = await getCollectionData({
        fileSystemData,
        collection,
        additionalDataProvider,
    });

    if (!data) {
        return undefined;
    }

    const registeredDataWithSamePath = collection.getStoredDataForPath(
        data.item.getPath(),
    );

    if (!registeredDataWithSamePath) {
        collection.addItem(data);
        return data;
    }

    handleAlreadyRegisteredItemWithSamePath(
        collection,
        registeredDataWithSamePath,
        data,
        additionalDataProvider,
    );
    return data;
}

async function getCollectionData<T>(params: {
    fileSystemData: FileSystemData;
    collection: Collection<T>;
    additionalDataProvider: AdditionalCollectionDataProvider<T>;
}): Promise<CollectionData<T> | undefined> {
    const { additionalDataProvider, collection, fileSystemData } = params;
    const itemType = await getItemType(collection, fileSystemData);

    const path = getFileSystemDataPath(fileSystemData);

    const item = itemType
        ? await getCollectionItem(collection, {
              path,
              itemType,
          })
        : undefined;

    if (!item) {
        return undefined;
    }

    if (
        additionalDataProvider.paramType ==
        AdditionalCollectionDataProviderType.SimpleCollectionItem
    ) {
        return {
            item,
            additionalData: additionalDataProvider.callback(
                item,
                collection.isRootDirectory(item.getPath()),
            ),
        };
    }

    const {
        callbacksForItemsRequiringFullParsing: {
            getData,
            getFilePathForParsing,
        },
        callbackForOtherItems,
        itemTypesRequiringFullFileParsing,
    } = additionalDataProvider;

    if (itemTypesRequiringFullFileParsing.includes(item.getItemType())) {
        const toParse = getFilePathForParsing(item);
        return {
            item,
            additionalData: getData(
                toParse ? await parseFile(toParse) : undefined,
            ),
        };
    }

    return { item, additionalData: callbackForOtherItems(item) };
}

function handleAlreadyRegisteredItemWithSamePath<T>(
    collection: Collection<T>,
    oldData: CollectionData<T>,
    newData: CollectionData<T>,
    additionalDataProvider: AdditionalCollectionDataProvider<T>,
) {
    if (isModifiedItemOutdated(oldData, newData, additionalDataProvider)) {
        collection.removeTestItemIfRegistered(oldData.item.getPath());
        collection.addItem(newData);
    }
}

async function parseFile(path: string) {
    const content = await promisify(readFile)(path, {
        encoding: "utf-8",
    }).catch(() => undefined);

    return content ? parseBruFile(new TextDocumentHelper(content)) : undefined;
}
