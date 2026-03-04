import { BrunoVariableReference } from "..";

export interface CollectionItemWithSequence extends CollectionItem {
    getSequence: () => number | undefined;
}

export interface CollectionItemWithBruVariables extends CollectionItem {
    getVariableReferences: () => BrunoVariableReference[];
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
    | {
          paramType: AdditionalCollectionDataProviderType.SimpleCollectionItem;
          callback: (item: CollectionItem) => T;
      }
    | {
          paramType: AdditionalCollectionDataProviderType.WithAdditionalData;
          callbackForItemsWithVariables: (
              item: CollectionItemWithBruVariables,
          ) => T;
          callbackForOtherItems: (item: CollectionItem) => T;
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
