import {
    AdditionalCollectionComplexDataProvider,
    AdditionalCollectionDataProviderType,
    AdditionalCollectionSimpleDataProvider,
    CollectionFormat,
    CollectionItem,
    parseFileByPath,
} from "../..";

export async function getAdditionalCollectionData<T>(
    item: CollectionItem,
    additionalDataProvider:
        | AdditionalCollectionSimpleDataProvider<T>
        | AdditionalCollectionComplexDataProvider<T>,
    isCollectionRoot: boolean,
    format = CollectionFormat.Bru,
) {
    switch (additionalDataProvider.paramType) {
        case AdditionalCollectionDataProviderType.SimpleCollectionItem:
            return additionalDataProvider.callback(item, isCollectionRoot);
        case AdditionalCollectionDataProviderType.WithAdditionalFullParsing:
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

            const toParse = getFilePathForParsing(item);
            return getData(
                // ToDo: Support extracting additional data from yaml files, too. Currently, `parseFileByPath` only supports the bru format.
                toParse && format == CollectionFormat.Bru
                    ? await parseFileByPath(toParse, item.getItemType())
                    : undefined,
            );
    }
}
