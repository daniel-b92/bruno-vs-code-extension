import * as vscode from "vscode";
import * as testTreeHelper from "../testTreeHelper";
import { TestCollection } from "../model/testCollection";

export const addTestCollection = (
    controller: vscode.TestController,
    collectionRootDir: string
) => {
    const uri = vscode.Uri.file(collectionRootDir);

    const vsCodeItem = controller.createTestItem(
        testTreeHelper.getTestId(uri),
        testTreeHelper.getTestLabel(uri),
        uri
    );

    vsCodeItem.canResolveChildren = true;
    controller.items.add(vsCodeItem);

    return new TestCollection(collectionRootDir, vsCodeItem);
};
