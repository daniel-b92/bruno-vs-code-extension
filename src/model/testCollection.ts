import { TestItem as vscodeTestItem } from "vscode";
import { BrunoTestData } from "../testTreeHelper";
import { TestDirectory } from "./testDirectory";

export class TestCollection {
    constructor(public rootDirectory: string, testItem: vscodeTestItem) {
        this.testData.set(testItem, new TestDirectory(rootDirectory));
    }

    public testData = new Map<vscodeTestItem, BrunoTestData>();
}
