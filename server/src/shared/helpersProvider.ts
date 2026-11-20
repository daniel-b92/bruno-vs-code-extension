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
} from "@global_shared";
import { Evt } from "evt";
import {
    AdditionalCollectionData,
    getDefaultLogger,
    TypedCollectionItemProvider,
} from ".";

export class HelpersProvider {
    constructor(
        workspaceFolders: string[],
        runInitialCacheLoad: (load: () => Promise<void>) => Promise<void>,
    ) {
        this.fileChangedEmitter = Evt.create<FileChangedEvent>();
        this.collectionWatcher = new CollectionWatcher(
            this.fileChangedEmitter,
            workspaceFolders,
            getDefaultLogger(),
        );
        this.itemProvider =
            new CollectionItemProvider<AdditionalCollectionData>(
                this.collectionWatcher,
                workspaceFolders,
                getAdditionalCollectionDataProvider(),
                getPathsToIgnoreForCollections(),
                undefined,
                getDefaultLogger(),
                undefined,
                runInitialCacheLoad,
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
        paramType:
            AdditionalCollectionDataProviderType.WithAdditionalFullParsing,
        itemTypesRequiringFullFileParsing: [
            BrunoFileType.RequestFile,
            NonBrunoSpecificItemType.Directory,
        ],
        callbacksForItemsRequiringFullParsing: {
            getData(parsedData) {
                return parsedData?.sections.flatMap(
                    ({ kind, name, variableReferences }) =>
                        variableReferences.map((reference) => ({
                            reference,
                            sectionKind: kind,
                            sectionName: name,
                        })),
                );
            },
            getFilePathForParsing(item) {
                return item.isFile()
                    ? item.getPath()
                    : (item as CollectionDirectory).getSettingsFilePath();
            },
        },
        callbackForOtherItems: () => undefined,
        isAdditionalDataOutdated: (oldData, newData) => {
            return !areVariableReferencesEquivalent(
                oldData?.map(({ reference }) => reference) ?? [],
                newData?.map(({ reference }) => reference) ?? [],
            );
        },
    };
}
