import { TestController, Uri } from "vscode";
import { getTestId } from "./testTreeHelper";
import { FileChangeType } from "../../../shared/fileSystem/fileChangesDefinitions";
import { CollectionItemProvider } from "../../../shared/state/collectionItemProvider";

export function handleTestTreeUpdates(
    controller: TestController,
    collectionItemProvider: CollectionItemProvider
) {
    collectionItemProvider.subscribeToUpdates()(
        async ({ data: { testItem }, updateType, changedData }) => {
            if (updateType == FileChangeType.Created && testItem) {
                controller.items.add(testItem);
            } else if (
                updateType == FileChangeType.Modified &&
                testItem &&
                changedData
            ) {
                /* For directories, no changes are ever registered because renaming a directory is seen as a creation of a new directory with the
                new name and a deletion of the directory with the old name. */
                if (changedData.sequence) {
                    controller.items.add(testItem);
                } else {
                    // This case can e.g. happen if the sequence in the a .bru file is changed to an invalid value
                    controller.items.delete(getTestId(testItem.uri as Uri));
                }
            } else if (updateType == FileChangeType.Deleted && testItem) {
                controller.items.delete(getTestId(testItem.uri as Uri));
            }
        }
    );
}
