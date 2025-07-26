import { TestItem } from "vscode";
import { BrunoTreeItem } from "../../treeView/brunoTreeItem";
import { Range } from "../fileSystem/util/range";

export interface CollectionItem {
    getPath: () => string;
    getSequence: () => number | undefined;
}

export interface CollectionData {
    item: CollectionItem;
    treeItem: BrunoTreeItem;
    testItem: TestItem;
}

export interface FileVariables {
    setEnvironmentVars: VariableReference[];
    usedEnvironmentVars: VariableReference[];
}

export interface VariableReference {
    name: string;
    range: Range;
}
