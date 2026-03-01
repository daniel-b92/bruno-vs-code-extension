import { Block, TextOutsideOfBlocks } from "..";

export interface CollectionItemWithSequence extends CollectionItem {
    getSequence: () => number | undefined;
}

export interface CollectionItem {
    getPath: () => string;
    isFile: () => boolean;
    getItemType: () => ItemType;
}

export enum AdditionalCollectionDataProviderParamType {
    CollectionItem = 1,
    ParsedBruFileData = 2,
}

export type AdditionalCollectionDataProvider<T> =
    | {
          paramType: AdditionalCollectionDataProviderParamType.CollectionItem;
          callback: (item: CollectionItem) => T;
      }
    | {
          paramType: AdditionalCollectionDataProviderParamType.ParsedBruFileData;
          callback: (parsedBruFileData: {
              blocks: Block[];
              textOutsideOfBlocks: TextOutsideOfBlocks[];
          }) => T;
      };

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
