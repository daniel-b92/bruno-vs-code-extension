import { TestCollection } from "../../testData/testCollection";
import { TestDirectory } from "../../testData/testDirectory";
import { TestController } from "vscode";
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
