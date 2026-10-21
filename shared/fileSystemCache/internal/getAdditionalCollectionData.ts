import {
    AdditionalCollectionComplexDataProvider,
    AdditionalCollectionDataProviderType,
    AdditionalCollectionSimpleDataProvider,
    CollectionFormat,
    CollectionItem,
    BrunoFileType,
    getVariableScopeSectionsFromFileByPath,
    ItemType,
    NonBrunoSpecificItemType,
} from "../..";

export async function getAdditionalCollectionData<T>(
    item: CollectionItem,
    additionalDataProvider:
        | AdditionalCollectionSimpleDataProvider<T>
        | AdditionalCollectionComplexDataProvider<T>,
    isCollectionRoot: boolean,
    format: CollectionFormat,
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
            const sections = toParse
                ? await getVariableScopeSectionsFromFileByPath(
                      toParse,
                      getItemTypeForParsing(
                          item.getItemType(),
                          isCollectionRoot,
                          format,
                      ),
                      format,
                  )
                : undefined;

            return getData(sections ? { sections } : undefined);
    }
}

function getItemTypeForParsing(
    itemType: ItemType,
    isCollectionRoot: boolean,
    format: CollectionFormat,
) {
    // For the Bru format, directories are parsed as is. In the Yaml format, the exact type of settings file is needed.
    return format == CollectionFormat.Yaml &&
        itemType == NonBrunoSpecificItemType.Directory
        ? isCollectionRoot
            ? BrunoFileType.CollectionSettingsFile
            : BrunoFileType.FolderSettingsFile
        : itemType;
}
