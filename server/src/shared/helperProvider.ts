import {
    FileChangedEvent,
    CollectionWatcher,
    CollectionItemProvider,
} from "@global_shared";
import { Evt } from "evt";
import { AdditionalCollectionData, TypedCollectionItemProvider } from ".";

export class HelpersProvider {
    constructor(workspaceFolders: string[]) {
        this.fileChangedEmitter = Evt.create<FileChangedEvent>();
        this.collectionWatcher = new CollectionWatcher(
            this.fileChangedEmitter,
            workspaceFolders,
        );
        this.itemProvider =
            new CollectionItemProvider<AdditionalCollectionData>(
                this.collectionWatcher,
                () => {},
                [],
            );
    }

    private fileChangedEmitter: Evt<FileChangedEvent>;
    private collectionWatcher: CollectionWatcher;
    private itemProvider: TypedCollectionItemProvider;

    public getItemProvider() {
        return this.itemProvider;
    }
}
