import {
    FileChangedEvent,
    CollectionWatcher,
    CollectionItemProvider,
    getPathsToIgnoreForCollections,
    AdditionalCollectionComplexDataProvider,
    AdditionalCollectionDataProviderType,
    BrunoFileType,
    NonBrunoSpecificItemType,
    CollectionItem,
    areVariableReferencesEquivalent,
    getFolderSettingsFilePath,
    CollectionDirectory,
} from "@global_shared";
import { Evt } from "evt";
import {
    AdditionalCollectionData,
    getDefaultLogger,
    TypedCollectionItemProvider,
} from ".";

export class HelpersProvider {
    constructor(workspaceFolders: string[]) {
        this.fileChangedEmitter = Evt.create<FileChangedEvent>();
        this.collectionWatcher = new CollectionWatcher(
            this.fileChangedEmitter,
            workspaceFolders,
            getDefaultLogger(),
        );
        this.itemProvider =
            new CollectionItemProvider<AdditionalCollectionData>(
                this.collectionWatcher,
                () => {},
                getPathsToIgnoreForCollections(),
                getDefaultLogger(),
            );
    }

    private fileChangedEmitter: Evt<FileChangedEvent>;
    private collectionWatcher: CollectionWatcher;
    private itemProvider: TypedCollectionItemProvider;

    public getItemProvider() {
        return this.itemProvider;
    }

    public dispose() {
        this.itemProvider.dispose();
        this.collectionWatcher.dispose();
    }
}

function getAdditionalCollectionDataProvider(): AdditionalCollectionComplexDataProvider<AdditionalCollectionData> {
    return {
        paramType: AdditionalCollectionDataProviderType.WithAdditionalData,
        itemTypesRequiringFullFileParsing: [
            BrunoFileType.RequestFile,
            NonBrunoSpecificItemType.Directory,
        ],
        callbacksForItemsRequiringFullParsing: {
            getData,
            getFilePathForParsing(item) {
                return item.isFile()
                    ? item.getPath()
                    : (item as CollectionDirectory).getSettingsFilePath();
            },
        },
        callbackForOtherItems: (item) => [],
        isAdditionalDataOutdated: (oldData, newData) => {
            return areVariableReferencesEquivalent(
                oldData.flatMap(({ references }) => references),
                newData.flatMap(({ references }) => references),
            );
        },
    };
}
