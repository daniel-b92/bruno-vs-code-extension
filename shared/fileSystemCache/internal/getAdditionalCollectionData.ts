import {
    AdditionalCollectionComplexDataProvider,
    AdditionalCollectionDataProviderType,
    AdditionalCollectionSimpleDataProvider,
    CollectionItem,
    parseFileByPath,
} from "../..";

export async function getAdditionalCollectionData<T>(
    item: CollectionItem,
    additionalDataProvider:
        | AdditionalCollectionSimpleDataProvider<T>
        | AdditionalCollectionComplexDataProvider<T>,
    isCollectionRoot: boolean,
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
                toParse ? await parseFileByPath(toParse) : undefined,
            );
    }
}
