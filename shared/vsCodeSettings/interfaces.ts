export interface ConfiguredEnvironmentPerCollectionSetting {
    perCollection: {
        collectionRoot: string;
        environmentName: string;
    }[];
}
