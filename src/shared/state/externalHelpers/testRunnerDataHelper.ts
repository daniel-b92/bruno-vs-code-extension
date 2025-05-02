import * as vscode from "vscode";
import { CollectionFile } from "../../model/collectionFile";
import { CollectionItem } from "../../model/interfaces";
import { getTestId, getTestLabel } from "../../../testRunner";
import { Collection } from "../../model/collection";
import { CollectionDirectory } from "../../model/collectionDirectory";
import { extname } from "path";
import { addTestItemAndAncestorsToTestTree } from "../../../testRunner";
import { normalizeDirectoryPath } from "../../fileSystem/util/normalizeDirectoryPath";

export class TestRunnerDataHelper {
    constructor(private testController: vscode.TestController) {}

    public createVsCodeTestItem = (item: CollectionItem) => {
        const getSortText = (file: CollectionFile) =>
            file.getSequence()
                ? new Array((file.getSequence() as number) + 1).join("a")
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
                    extname(item.getPath()) == ".bru" &&
                    item
                        .getPath()
                        .startsWith(normalizeDirectoryPath(directory.getPath()))
            );
    }
}
