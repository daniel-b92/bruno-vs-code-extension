import { promisify } from "util";
import {
    AdditionalCollectionComplexDataProvider,
    AdditionalCollectionDataProviderType,
    AdditionalCollectionSimpleDataProvider,
    CollectionItem,
    parseBruFile,
    TextDocumentHelper,
} from "..";
import { readFile } from "fs";

export async function getAdditionalCollectionData<T>(
    item: CollectionItem,
    additionalDataProvider:
        | AdditionalCollectionSimpleDataProvider<T>
        | AdditionalCollectionComplexDataProvider<T>,
) {
    switch (additionalDataProvider.paramType) {
        case AdditionalCollectionDataProviderType.SimpleCollectionItem:
            return additionalDataProvider.callback(item);
        case AdditionalCollectionDataProviderType.WithAdditionalData:
            const {
                callbacksForItemsRequiringFullParsing: {
                    getData,
                    getFilePathForParsing,
                },
                callbackForOtherItems,
                itemTypesRequiringFullFileParsing,
            } = additionalDataProvider;

            if (
                !itemTypesRequiringFullFileParsing.includes(item.getItemType())
            ) {
                return callbackForOtherItems(item);
            }

            const parsedFileData = await parseFile(getFilePathForParsing(item));
            return parsedFileData ? getData(parsedFileData) : undefined;
    }
}

async function parseFile(path: string) {
    const content = await promisify(readFile)(path, {
        encoding: "utf-8",
    }).catch(() => undefined);

    return content ? parseBruFile(new TextDocumentHelper(content)) : undefined;
}
