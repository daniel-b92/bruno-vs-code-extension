import {
    FileChangedEvent,
    CollectionWatcher,
    CollectionItemProvider,
    getPathsToIgnoreForCollections,
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
}
