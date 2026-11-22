import * as vscode from "vscode";
import { BrunoTreeItem, contextRootIcon } from "@shared";

export const contextRootContextValues = {
    root: "contextRoot",
    folder: "contextRootFolder",
    file: "contextRootFile",
} as const;

export interface ContextRootDetails {
    /** The path of the root relative to the workspace folder, or the absolute path if it is located outside of the workspace. Helps to tell apart roots with the same folder name. */
    description: string;
    /** The names of the collections that configured the root as an additional context root. */
    collectionNames: string[];
}

/**
 * A node in the collection explorer for a folder with shared scripts outside of the collections (an additional context root), or for one of its descendants.
 *
 * Other than for items of collections, no Bruno specific actions are available for these nodes (e.g. creating requests, starting test runs or selecting environments).
 */
export class ContextRootTreeItem extends BrunoTreeItem {
    constructor(
        path: string,
        isFile: boolean,
        /** Only defined for the top-level node of a context root. */
        rootDetails?: ContextRootDetails,
    ) {
        super(path, isFile, false);

        this.isTopLevel = rootDetails !== undefined;
        this.contextValue = rootDetails
            ? contextRootContextValues.root
            : isFile
              ? contextRootContextValues.file
              : contextRootContextValues.folder;

        if (rootDetails) {
            this.iconPath = contextRootIcon;
            this.setRootDetails(rootDetails);
        }
    }

    public readonly isTopLevel: boolean;

    public setRootDetails({
        description,
        collectionNames,
    }: ContextRootDetails) {
        this.description = description;
        this.tooltip = new vscode.MarkdownString(
            `Additional context root of ${
                collectionNames.length == 1 ? "collection" : "collections"
            } ${collectionNames.map((name) => `'${name}'`).join(", ")}\n\n${this.path}`,
        );
    }
}
