import * as vscode from "vscode";
import { CollectionFile } from "./model/collectionFile";
import { CollectionItem } from "./model/interfaces";
import {
    getTestId,
    getTestLabel,
} from "../../testRunner/vsCodeTestTree/utils/testTreeHelper";

export class TestRunnerDataHelper {
    constructor(private testController: vscode.TestController) {}

    public createVsCodeTestItem = (item: CollectionItem) => {
        const getSortText = (file: CollectionFile) =>
            file.getSequence()
                ? new Array((file.getSequence() as number) + 1).join("a")
                : undefined;

        const uri = vscode.Uri.file(item.getPath());
        const vsCodeItem = this.testController.createTestItem(
            getTestId(uri),
            getTestLabel(uri),
            uri
        );

        if (item instanceof CollectionFile) {
            vsCodeItem.canResolveChildren = false;
            vsCodeItem.sortText = getSortText(item);
        } else {
            vsCodeItem.canResolveChildren = true;
        }

        return vsCodeItem;
    };
}
