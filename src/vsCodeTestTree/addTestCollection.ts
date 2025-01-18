import { TestController, Uri } from "vscode";
import { TestCollection } from "../model/testCollection";
import { getTestId, getTestLabel } from "../testTreeHelper";

export const addTestCollection = (
    controller: TestController,
    collectionRootDir: string
) => {
    const uri = Uri.file(collectionRootDir);

    const vsCodeItem = controller.createTestItem(
        getTestId(uri),
        getTestLabel(uri),
        uri
    );

    vsCodeItem.canResolveChildren = true;
    controller.items.add(vsCodeItem);

    return new TestCollection(collectionRootDir, vsCodeItem);
};
