import { basename } from "path";
import * as vscode from "vscode";

export class BrunoTreeItem extends vscode.TreeItem {
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

    public getPath() {
        return this.path;
    }

    public getSequence() {
        return this.sequence;
    }
}
