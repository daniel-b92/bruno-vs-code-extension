import { TestRunnerDataHelper } from "..";
import { BrunoTreeItem } from "../../model/brunoTreeItem";
import { Collection } from "../../model/collection";
import { CollectionDirectory } from "../../model/collectionDirectory";
import { CollectionFile } from "../../model/collectionFile";
import { CollectionData } from "../../model/interfaces";

export function addItemToCollection(
    testRunnerDataHelper: TestRunnerDataHelper,
    collection: Collection,
    item: CollectionFile | CollectionDirectory
) {
    const isFile = item instanceof CollectionFile;

    const data: CollectionData = {
        item,
        treeItem: new BrunoTreeItem(
            item.getPath(),
            isFile,
            isFile ? item.getSequence() : undefined
        ),
        testItem: testRunnerDataHelper.createVsCodeTestItem(item),
    };

    collection.addItem(data);

    return data;
}
