import * as vscode from "vscode";
import {
    getSortText,
} from "../testTreeHelper";
import { getSequence } from "../parser";
import { TestCollection } from "./testCollection";

export class TestFile {
    constructor(public path: string, public sequence: number) {}

    /**
     * Updates the data for an existing test file.
     */
    public updateFromDisk(fileItem: vscode.TestItem, collection: TestCollection) {
        const sequence = getSequence(this.path);

        if (sequence) {
            this.sequence = sequence;
        }
        fileItem.sortText = getSortText(this);
        collection.testData.set(fileItem, this);
    }
}
