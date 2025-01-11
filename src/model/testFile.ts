import * as vscode from "vscode";
import { getSortText, getTestId, getTestLabel, testData } from "../testTreeHelper";
import { getSequence } from "../parser";

export class TestFile {
    constructor(public path: string, public sequence: number) {}

    public getTestId() {
        return getTestId(vscode.Uri.file(this.path));
    }

    /**
     * Updates the data for an existing test file.
     */
    public updateFromDisk(
        controller: vscode.TestController,
        item: vscode.TestItem
    ) {
        this.sequence = getSequence(this.path);
        item.sortText = getSortText(this);
        testData.set(item, this);
    }
}
