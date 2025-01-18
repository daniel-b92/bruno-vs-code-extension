import {
    TestItem as vscodeTestItem,
    TestController as vscodeTestController,
} from "vscode";
import { getTestId, getTestLabel } from "../testTreeHelper";
import { TestCollection } from "./testCollection";

export class TestDirectory {
    constructor(public path: string) {}

    public async updateFromDisk(
        controller: vscodeTestController,
        directoryItem: vscodeTestItem,
        collection: TestCollection
    ) {
        try {
            directoryItem.error = undefined;
            this.updateFromContents(controller, directoryItem, collection);
        } catch (e) {
            directoryItem.error = (e as Error).stack;
        }
    }

    public updateFromContents(
        controller: vscodeTestController,
        directoryItem: vscodeTestItem,
        collection: TestCollection
    ) {
        const testDirectory = controller.createTestItem(
            getTestId(directoryItem.uri!),
            getTestLabel(directoryItem.uri!),
            directoryItem.uri
        );
        collection.testData.set(testDirectory, this);
    }
}
