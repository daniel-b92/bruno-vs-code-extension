import { promisify } from "util";
import {
    AdditionalCollectionDataProviderType,
    AdditionalCollectionDataProvider,
    Collection,
    CollectionData,
    parseBruFile,
    TextDocumentHelper,
} from "../..";
import { getCollectionItem } from "./getCollectionItem";
import { isModifiedItemOutdated } from "./isModifiedItemOutdated";
import { readFile } from "fs";

export async function addItemToCollection<T>(
    newItem: {
        path: string;
        collection: Collection<T>;
        additionalDataProvider: AdditionalCollectionDataProvider<T>;
    },
    replaceExistingItem = true,
) {
    const { additionalDataProvider, collection, path } = newItem;

    const data = await getCollectionData({
        path,
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
        replaceExistingItem,
    );
    return data;
}

async function getCollectionData<T>(params: {
    path: string;
    collection: Collection<T>;
    additionalDataProvider: AdditionalCollectionDataProvider<T>;
}): Promise<CollectionData<T> | undefined> {
    const { additionalDataProvider, collection, path } = params;
    const item = await getCollectionItem(collection, path);

    if (!item) {
        return undefined;
    }

    if (
        additionalDataProvider.paramType ==
        AdditionalCollectionDataProviderType.SimpleCollectionItem
    ) {
        return { item, additionalData: additionalDataProvider.callback(item) };
    }

    const {
        callbacksForItemsRequiringFullParsing: {
            getData,
            getFilePathForParsing,
        },
        fallbackDataForNonParseableFilePath,
        callbackForOtherItems,
        itemTypesRequiringFullFileParsing,
    } = additionalDataProvider;

    if (itemTypesRequiringFullFileParsing.includes(item.getItemType())) {
        const toParse = getFilePathForParsing(item);
        const parsedFile = toParse ? await parseFile(toParse) : undefined;
        return {
            item,
            additionalData: parsedFile
                ? getData(parsedFile)
                : fallbackDataForNonParseableFilePath,
        };
    }

    return { item, additionalData: callbackForOtherItems(item) };
}

function handleAlreadyRegisteredItemWithSamePath<T>(
    collection: Collection<T>,
    oldData: CollectionData<T>,
    newData: CollectionData<T>,
    additionalDataProvider: AdditionalCollectionDataProvider<T>,
    replaceExistingItem: boolean,
) {
    if (!replaceExistingItem) {
        return;
    }

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
