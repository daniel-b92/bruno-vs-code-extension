import {
    AdditionalCollectionComplexDataProvider,
    AdditionalCollectionDataProviderType,
    AdditionalCollectionSimpleDataProvider,
    CollectionItem,
    ParsedFileDataForComplexProvider,
} from "..";

export function getAdditionalCollectionData<T>(
    item: CollectionItem,
    additionalDataProvider:
        | { provider: AdditionalCollectionSimpleDataProvider<T> }
        | {
              parsedFileData: ParsedFileDataForComplexProvider;
              provider: AdditionalCollectionComplexDataProvider<T>;
          },
) {
    const { provider } = additionalDataProvider;

    switch (provider.paramType) {
        case AdditionalCollectionDataProviderType.SimpleCollectionItem:
            return provider.callback(item);
        case AdditionalCollectionDataProviderType.WithAdditionalData:
            const {
                parsedFileData,
                provider: {
                    callbacksForItemsRequiringFullParsing: { getData },
                    callbackForOtherItems,
                    itemTypesRequiringFullFileParsing,
                },
            } = additionalDataProvider as {
                parsedFileData: ParsedFileDataForComplexProvider;
                provider: AdditionalCollectionComplexDataProvider<T>;
            };

            return itemTypesRequiringFullFileParsing.includes(
                item.getItemType(),
            )
                ? getData(parsedFileData)
                : callbackForOtherItems(item);
    }
}
