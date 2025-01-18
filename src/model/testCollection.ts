import { TestItem as vscodeTestItem } from "vscode";
import { BrunoTestData } from "../testTreeHelper";

export class TestCollection {
    constructor(public rootDirectory: string, public testItem: vscodeTestItem) {
    }

    public testDescendants = new Map<vscodeTestItem, BrunoTestData>();
}
