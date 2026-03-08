import {
    FileChangedEvent,
    CollectionWatcher,
    CollectionItemProvider,
    getPathsToIgnoreForCollections,
    AdditionalCollectionComplexDataProvider,
    AdditionalCollectionDataProviderType,
    BrunoFileType,
    NonBrunoSpecificItemType,
    areVariableReferencesEquivalent,
    CollectionDirectory,
    getAllVariablesFromBlocks,
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
                getAdditionalCollectionDataProvider(),
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
            getData({ blocks }) {
                return {
                    variableReferences: getAllVariablesFromBlocks(blocks),
                };
            },
            getFilePathForParsing(item) {
                return item.isFile()
                    ? item.getPath()
                    : (item as CollectionDirectory).getSettingsFilePath();
            },
        },
        fallbackDataForNonParseableFilePath: { variableReferences: [] },
        callbackForOtherItems: () => ({ variableReferences: [] }),
        isAdditionalDataOutdated: (oldData, newData) => {
            return !areVariableReferencesEquivalent(
                oldData.variableReferences,
                newData.variableReferences,
            );
        },
    };
}
