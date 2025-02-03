import { FileSystemWatcher, TestController, Uri } from "vscode";
import { TestCollection } from "../../model/testCollection";
import { getTestId } from "../../testTreeHelper";
import { CollectionRegister } from "../../model/collectionRegister";

export const handleTestCollectionDeletion = (
    controller: TestController,
    collectionRegister: CollectionRegister,
    collectionWatchers: {
        collection: TestCollection;
        watcher: FileSystemWatcher;
    }[],
    collection: TestCollection
) => {
    collectionRegister.unregisterCollection(collection);

    const { watcher } = collectionWatchers.splice(
        collectionWatchers.findIndex(
            ({ collection: col }) =>
                collection.rootDirectory == col.rootDirectory
        ),
        1
    )[0];
    watcher.dispose();

    controller.items.delete(getTestId(Uri.file(collection.rootDirectory)));
};
