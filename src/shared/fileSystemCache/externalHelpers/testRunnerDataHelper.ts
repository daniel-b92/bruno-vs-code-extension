import * as vscode from "vscode";
import { getTestId, getTestLabel } from "../../../testRunner";
import { extname } from "path";
import { addTestItemAndAncestorsToTestTree } from "../../../testRunner";
import {
    Collection,
    CollectionDirectory,
    CollectionFile,
    CollectionItem,
    doesFileNameMatchFolderSettingsFileName,
    getExtensionForRequestFiles,
    normalizeDirectoryPath,
} from "../..";

export class TestRunnerDataHelper {
    constructor(private testController: vscode.TestController) {}

    public createVsCodeTestItem = (item: CollectionItem) => {
        const getSortText = (item: CollectionItem) =>
            item.getSequence()
                ? new Array((item.getSequence() as number) + 1).join("a")
                : undefined;

        const uri = vscode.Uri.file(item.getPath());
        const testItem = this.testController.createTestItem(
            getTestId(uri),
            getTestLabel(uri),
            uri
        );

        if (item instanceof CollectionFile) {
            testItem.canResolveChildren = false;
            testItem.sortText = getSortText(item);
        } else {
            testItem.canResolveChildren = true;
        }

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
                    item.getSequence() != undefined &&
                    extname(item.getPath()) == getExtensionForRequestFiles() &&
                    doesFileNameMatchFolderSettingsFileName(item.getPath()) &&
                    item
                        .getPath()
                        .startsWith(normalizeDirectoryPath(directory.getPath()))
            );
    }
}
