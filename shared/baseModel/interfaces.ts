import { Block, TextOutsideOfBlocks } from "..";

export interface CollectionItemWithSequence extends CollectionItem {
    getSequence: () => number | undefined;
}

export interface CollectionItem {
    getPath: () => string;
    isFile: () => boolean;
    getItemType: () => ItemType;
}

export enum AdditionalCollectionDataProviderType {
    SimpleCollectionItem = 1,
    WithAdditionalData = 2,
}

export type AdditionalCollectionDataProvider<T> =
    | AdditionalCollectionSimpleDataProvider<T>
    | AdditionalCollectionComplexDataProvider<T>;

export interface AdditionalCollectionSimpleDataProvider<T> {
    paramType: AdditionalCollectionDataProviderType.SimpleCollectionItem;
    callback: (item: CollectionItem) => T;
}

export interface AdditionalCollectionComplexDataProvider<T> {
    paramType: AdditionalCollectionDataProviderType.WithAdditionalData;
    itemTypesRequiringFullFileParsing: ItemType[];
    callbacksForItemsRequiringFullParsing: {
        getFilePathForParsing: (item: CollectionItem) => string | undefined;
        getData: (parsedFile: ParsedFileDataForComplexProvider) => T;
    };
    fallbackDataForNonParseableFilePath: T;
    callbackForOtherItems: (item: CollectionItem) => T;
    isAdditionalDataOutdated: (oldData: T, newData: T) => boolean;
}

export interface ParsedFileDataForComplexProvider {
    blocks: Block[];
    textOutsideOfBlocks: TextOutsideOfBlocks[];
}

export type CollectionData<T> = {
    item: CollectionItem;
    additionalData: T;
};

export type ItemType = BrunoFileType | NonBrunoSpecificItemType;

export enum NonBrunoSpecificItemType {
    OtherFileType = "OtherFileType",
    Directory = "Directory",
}

export enum BrunoFileType {
    RequestFile = "RequestFile",
    FolderSettingsFile = "FolderSettingsFile",
    CollectionSettingsFile = "CollectionSettingsFile",
    EnvironmentFile = "EnvironmentFile",
}
