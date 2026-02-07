export interface CollectionItemWithSequence extends CollectionItem {
    getSequence: () => number | undefined;
}

export interface CollectionItem {
    getPath: () => string;
    isFile: () => boolean;
    getItemType: () => ItemType;
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
