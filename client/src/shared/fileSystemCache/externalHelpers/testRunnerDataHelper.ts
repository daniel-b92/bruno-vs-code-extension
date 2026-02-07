import * as vscode from "vscode";
import {
    getTestId,
    getTestLabel,
    addTestItemAndAncestorsToTestTree,
} from "../../../testRunner";
import { normalizeDirectoryPath } from "@global_shared";
import {
    CollectionDirectory,
    CollectionItemWithSequence,
    CollectionItem,
    isCollectionItemWithSequence,
    isRequestFile,
    TypedCollection,
} from "@shared";

export class TestRunnerDataHelper {
    constructor(private testController: vscode.TestController) {}

    public createVsCodeTestItem = (item: CollectionItem) => {
        const uri = vscode.Uri.file(item.getPath());
        const testItem = this.testController.createTestItem(
            getTestId(uri),
            getTestLabel(uri),
            uri,
        );

        testItem.canResolveChildren = !item.isFile();
        testItem.sortText = this.getVsCodeTestItemSortText(item);

        if (isRequestFile(item) && item.getTags()) {
            testItem.description = "tags: (".concat(
                (item.getTags() as string[]).map((t) => `'${t}'`).join(","),
                ")",
            );
        }

        return testItem;
    };

    public async addTestTreeItemsForDirectoryAndDescendants(
        collectionForDirectory: TypedCollection,
        directory: CollectionDirectory,
    ) {
        const relevantFiles = this.getTestFileDescendants(
            collectionForDirectory,
            directory,
        );

        for (const item of relevantFiles) {
            addTestItemAndAncestorsToTestTree(
                this.testController,
                collectionForDirectory,
                item,
            );
        }
    }

    public getTestFileDescendants(
        collectionForDirectory: TypedCollection,
        directory: CollectionDirectory,
    ) {
        const normalizedDirectoryPath = normalizeDirectoryPath(
            directory.getPath(),
        );

        return collectionForDirectory
            .getAllStoredDataForCollection()
            .slice()
            .map(({ item }) => item)
            .filter(
                (item) =>
                    item.isFile() &&
                    item.getPath().startsWith(normalizedDirectoryPath) &&
                    isCollectionItemWithSequence(item) &&
                    item.getSequence() != undefined,
            ) as CollectionItemWithSequence[];
    }

    public dispose() {}

    private getVsCodeTestItemSortText(item: CollectionItem) {
        return isCollectionItemWithSequence(item) && item.getSequence()
            ? (item instanceof CollectionDirectory ? "" : "b").concat(
                  new Array((item.getSequence() as number) + 1).join("a"),
              )
            : undefined;
    }
}
