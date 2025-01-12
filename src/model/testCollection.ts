import * as vscode from "vscode";
import { BrunoTestData } from "../testTreeHelper";
import { TestDirectory } from "./testDirectory";

export class TestCollection {
    constructor(public rootDirectory: string, testItem: vscode.TestItem) {
        this.testData.set(testItem, new TestDirectory(rootDirectory));
    }

    public testData = new Map<vscode.TestItem, BrunoTestData>();
}
