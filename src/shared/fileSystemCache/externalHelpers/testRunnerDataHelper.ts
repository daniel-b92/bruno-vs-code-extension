import * as vscode from "vscode";
import { getTestId, getTestLabel } from "../../../testRunner";
import { addTestItemAndAncestorsToTestTree } from "../../../testRunner";
import {
    BrunoFileType,
    Collection,
    CollectionDirectory,
    CollectionItemWithSequence,
    filterAsync,
    normalizeDirectoryPath,
    CollectionItem,
    isCollectionItemWithSequence,
    isRequestFile,
} from "../..";

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
            const tags = item.getTags() as string[];
            testItem.tags = tags.map((tag) => new vscode.TestTag(tag));
            testItem.description =
                tags.length > 0
                    ? "tags: ".concat(tags.map((t) => `'${t}'`).join(","))
                    : undefined;
        }

        return testItem;
    };

    public async addTestTreeItemsForDirectoryAndDescendants(
        collectionForDirectory: Collection,
        directory: CollectionDirectory,
    ) {
        const relevantFiles = await this.getTestFileDescendants(
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

    public async getTestFileDescendants(
        collectionForDirectory: Collection,
        directory: CollectionDirectory,
    ) {
        return (await filterAsync(
            collectionForDirectory
                .getAllStoredDataForCollection()
                .slice()
                .map(({ item }) => item),
            async (item) =>
                item.isFile() &&
                item.getItemType() == BrunoFileType.RequestFile &&
                isCollectionItemWithSequence(item) &&
                item.getSequence() != undefined &&
                item
                    .getPath()
                    .startsWith(normalizeDirectoryPath(directory.getPath())),
        )) as CollectionItemWithSequence[];
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
