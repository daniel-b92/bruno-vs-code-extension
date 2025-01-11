import * as vscode from "vscode";
import { getTestId, getTestLabel, testData } from "../testTreeHelper";

export class TestDirectory {
    constructor(public path: string) {}
    public didResolve = false;

    public async updateFromDisk(
        controller: vscode.TestController,
        directoryItem: vscode.TestItem
    ) {
        try {
            directoryItem.error = undefined;
            this.updateFromContents(controller, directoryItem);
        } catch (e) {
            directoryItem.error = (e as Error).stack;
        }
    }

    public updateFromContents(
        controller: vscode.TestController,
        item: vscode.TestItem
    ) {
        this.didResolve = true;

        const testDirectory = controller.createTestItem(
            getTestId(item.uri!),
            getTestLabel(item.uri!),
            item.uri
        );
        testData.set(testDirectory, this);
    }
}