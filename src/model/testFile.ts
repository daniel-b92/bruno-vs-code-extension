import * as vscode from "vscode";
import { getTestId, getTestLabel, testData } from "../testTreeHelper";

export class TestFile {
    constructor(public path: string, public sequence: number) {}
    public didResolve = false;

    public getTestId() {
        return getTestId(vscode.Uri.file(this.path));
    }

    public async updateFromDisk(
        controller: vscode.TestController,
        item: vscode.TestItem
    ) {
        try {
            item.error = undefined;
            this.updateFromContents(controller, item);
        } catch (e) {
            item.error = (e as Error).stack;
        }
    }

    /**
     * Parses the tests from the input text, and updates the tests contained
     * by this file to be those from the text,
     */
    public updateFromContents(
        controller: vscode.TestController,
        item: vscode.TestItem
    ) {
        this.didResolve = true;

        const tcase = controller.createTestItem(
            getTestId(item.uri!),
            getTestLabel(item.uri!),
            item.uri
        );
        testData.set(tcase, this);
    }
}
