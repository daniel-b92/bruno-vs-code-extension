import * as vscode from "vscode";
import { getTestId, getTestLabel } from "../../../testRunner";
import { addTestItemAndAncestorsToTestTree } from "../../../testRunner";
import {
    BrunoFileType,
    Collection,
    CollectionDirectory,
    CollectionFile,
    CollectionItem,
    getTypeOfBrunoFile,
    normalizeDirectoryPath,
} from "../..";

export class TestRunnerDataHelper {
    constructor(private testController: vscode.TestController) {}

    public createVsCodeTestItem = (item: CollectionItem) => {
        const uri = vscode.Uri.file(item.getPath());
        const testItem = this.testController.createTestItem(
            getTestId(uri),
            getTestLabel(uri),
            uri
        );

        if (item instanceof CollectionFile) {
            testItem.canResolveChildren = false;
        } else {
            testItem.canResolveChildren = true;
        }

        testItem.sortText = this.getVsCodeTestItemSortText(item);

        return testItem;
    };

    public addTestTreeItemsForDirectoryAndDescendants(
        collectionForDirectory: Collection,
        directory: CollectionDirectory
    ) {
        const relevantFiles = this.getTestFileDescendants(
            collectionForDirectory,
            directory
        );

        for (const { item } of relevantFiles) {
            addTestItemAndAncestorsToTestTree(
                this.testController,
                collectionForDirectory,
                item
            );
        }
    }

    public getTestFileDescendants(
        collectionForDirectory: Collection,
        directory: CollectionDirectory
    ) {
        return collectionForDirectory
            .getAllStoredDataForCollection()
            .filter(
                ({ item }) =>
                    item instanceof CollectionFile &&
                    getTypeOfBrunoFile(
                        [collectionForDirectory],
                        item.getPath()
                    ) == BrunoFileType.RequestFile &&
                    item.getSequence() != undefined &&
                    item
                        .getPath()
                        .startsWith(normalizeDirectoryPath(directory.getPath()))
            );
    }

    private getVsCodeTestItemSortText(item: CollectionItem) {
        return item.getSequence()
            ? new Array((item.getSequence() as number) + 1)
                  .join("a")
                  .concat(item instanceof CollectionDirectory ? "" : "b")
            : undefined;
    }
}
