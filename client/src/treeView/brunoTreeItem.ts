import { basename } from "path";
import * as vscode from "vscode";

export class BrunoTreeItem extends vscode.TreeItem {
    constructor(
        public readonly path: string,
        public readonly isFile: boolean,
        private sequence?: number,
        private tags?: string[],
    ) {
        super(
            basename(path),
            isFile
                ? vscode.TreeItemCollapsibleState.None
                : vscode.TreeItemCollapsibleState.Collapsed,
        );

        this.tooltip = this.getTooltip();
        this.description = this.getDescription();

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

    private getDescription() {
        if (!this.sequence && !this.tags) {
            return undefined;
        }

        const forSequence = this.sequence ? `seq: ${this.sequence}` : undefined;
        const forTags = this.tags
            ? `tags: (${this.tags.map((t) => `'${t}'`).join(",")})`
            : undefined;

        return forSequence && forTags
            ? `${forSequence}, ${forTags}`
            : [forSequence, forTags].filter((v) => v != undefined)[0];
    }

    private getTooltip() {
        const lineBreak = "\n";

        return this.sequence
            ? new vscode.MarkdownString(
                  `${this.label} (seq: ${this.sequence})`.concat(
                      this.tags && this.tags.length > 0
                          ? `${lineBreak}${lineBreak}tags: ${this.tags.map((t) => `${lineBreak}- ${t}`)}`
                          : "",
                  ),
              )
            : this.label
              ? this.label.toString()
              : undefined;
    }
}
