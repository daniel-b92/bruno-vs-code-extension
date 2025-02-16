import { lstatSync, readdirSync } from "fs";
import { basename, resolve } from "path";
import * as vscode from "vscode";
import { getAllCollectionRootDirectories } from "../shared/fileSystem/collectionRootFolderHelper";
import { getSequence } from "../shared/fileSystem/testFileParser";

export class BrunoTestDataProvider
    implements vscode.TreeDataProvider<TestData>
{
    constructor(private workspaceRoot: string) {}

    getTreeItem(element: TestData): vscode.TreeItem {
        return element as unknown as vscode.TreeItem;
    }

    async getChildren(element?: TestData): Promise<TestData[]> {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage(
                "No Bruno test data found in empty workspace"
            );
            return Promise.resolve([]);
        }

        if (!element) {
            return (await getAllCollectionRootDirectories()).map(
                (path) =>
                    new TestData(
                        path,
                        vscode.TreeItemCollapsibleState.Collapsed
                    )
            );
        } else {
            return Promise.resolve(
                readdirSync(element.path)
                    .map((childPath) => {
                        const fullPath = resolve(element.path, childPath);

                        return lstatSync(fullPath).isFile()
                            ? new TestData(
                                  fullPath,
                                  vscode.TreeItemCollapsibleState.None,
                                  getSequence(fullPath)
                              )
                            : new TestData(
                                  fullPath,
                                  vscode.TreeItemCollapsibleState.Collapsed
                              );
                    })
                    .sort((a, b) =>
                        a.getSequence() != undefined &&
                        b.getSequence() != undefined
                            ? (a.getSequence() as number) -
                              (b.getSequence() as number)
                            : 0
                    )
            );
        }
    }
}

class TestData extends vscode.TreeItem {
    constructor(
        public readonly path: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        private sequence?: number
    ) {
        super(basename(path), collapsibleState);
        this.tooltip = sequence
            ? `${this.label}-sequence_${this.sequence}`
            : `${this.label}`;
        this.description = sequence ? `sequence: ${this.sequence}` : undefined;
    }

    public getSequence() {
        return this.sequence;
    }
}
