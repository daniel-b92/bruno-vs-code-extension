import { TestItem as vscodeTestItem } from "vscode";
import { BrunoTestData } from "../testData/testDataDefinitions";
import { TestDirectory } from "./testDirectory";

export class TestCollection {
    constructor(public rootDirectory: string, testItem: vscodeTestItem) {
        this.testData.set(testItem, new TestDirectory(rootDirectory));
    }

    public testData = new Map<vscodeTestItem, BrunoTestData>();

    public getTestItemForPath = (path: string) =>
        Array.from(this.testData.keys()).find(
            (item) => item.uri?.fsPath == path
        );
}
