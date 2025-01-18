import * as vscode from "vscode";
import { TestCollection } from "../model/testCollection";
import { getTestId, getTestLabel } from "../testTreeHelper";

export const addTestCollection = (
    controller: vscode.TestController,
    collectionRootDir: string
) => {
    const uri = vscode.Uri.file(collectionRootDir);

    const vsCodeItem = controller.createTestItem(
        getTestId(uri),
        getTestLabel(uri),
        uri
    );

    vsCodeItem.canResolveChildren = true;
    controller.items.add(vsCodeItem);

    return new TestCollection(collectionRootDir, vsCodeItem);
};
