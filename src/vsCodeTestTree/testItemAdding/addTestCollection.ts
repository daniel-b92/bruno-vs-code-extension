import { TestController, Uri } from "vscode";
import { TestCollection } from "../../testData/testCollection";
import { getTestId, getTestLabel } from "../utils/testTreeHelper";

export const addTestCollectionToTestTree = (
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
