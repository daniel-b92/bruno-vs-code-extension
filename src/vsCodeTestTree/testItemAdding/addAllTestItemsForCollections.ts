import { TestCollection } from "../../model/testCollection";
import { TestDirectory } from "../../model/testDirectory";
import { TestController, TestItem as vscodeTestItem } from "vscode";
import { addTestDirectoryAndAllDescendants } from "./addTestDirectoryAndAllDescendants";

export async function addAllTestItemsForCollections(
    controller: TestController,
    testCollections: TestCollection[]
) {
    for (const collection of testCollections) {
        await addTestDirectoryAndAllDescendants(
            controller,
            collection,
            collection.testData.get(
                collection.getTestItemForPath(collection.rootDirectory)!
            ) as TestDirectory
        );
    }
}
