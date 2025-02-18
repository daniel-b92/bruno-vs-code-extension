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
                (path) => new TestData(path, false)
            );
        } else {
            return Promise.resolve(
                readdirSync(element.path)
                    .map((childPath) => {
                        const fullPath = resolve(element.path, childPath);

                        return lstatSync(fullPath).isFile()
                            ? new TestData(
                                  fullPath,
                                  true,
                                  getSequence(fullPath)
                              )
                            : new TestData(fullPath, false);
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
        public readonly isFile: boolean,
        private sequence?: number
    ) {
        super(
            basename(path),
            isFile
                ? vscode.TreeItemCollapsibleState.None
                : vscode.TreeItemCollapsibleState.Collapsed
        );

        this.tooltip = sequence
            ? `${this.label} (sequence: ${this.sequence})`
            : `${this.label}`;

        this.description = sequence ? `sequence: ${this.sequence}` : undefined;

        if (isFile) {
            this.command = {
                title: "open",
                command: "vscode.open",
                arguments: [vscode.Uri.file(path)],
            };
        }
    }

    public getSequence() {
        return this.sequence;
    }
}
