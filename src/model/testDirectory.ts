import * as vscode from "vscode";
import { getTestId, getTestLabel } from "../testTreeHelper";
import { TestCollection } from "./testCollection";

export class TestDirectory {
    constructor(public path: string) {}

    public async updateFromDisk(
        controller: vscode.TestController,
        directoryItem: vscode.TestItem,
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
        controller: vscode.TestController,
        directoryItem: vscode.TestItem,
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
