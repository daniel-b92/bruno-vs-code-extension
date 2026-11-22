import { describe, it, expect } from "@jest/globals";
import { MarkdownString } from "vscode";
import { ContextRootTreeItem } from "./contextRootTreeItem";

describe("ContextRootTreeItem", () => {
    it("is a top-level node with the context root icon, the given description and no command for a root", () => {
        const item = new ContextRootTreeItem("/shared/scripts", false, {
            description: "shared/scripts",
            collectionNames: ["first"],
        });

        expect(item.isTopLevel).toBe(true);
        expect(item.contextValue).toBe("contextRoot");
        expect(item.description).toBe("shared/scripts");
        expect((item.iconPath as { id: string }).id).toBe("folder-library");
        expect(item.command).toBeUndefined();
    });

    it("lists the names of the collections in the tooltip of a root", () => {
        const item = new ContextRootTreeItem("/shared/scripts", false, {
            description: "shared/scripts",
            collectionNames: ["first", "second"],
        });

        const tooltip = (item.tooltip as MarkdownString).value;

        expect(tooltip).toContain("collections 'first', 'second'");
        expect(tooltip).toContain("/shared/scripts");
    });

    it("updates description and tooltip when the details of a root change", () => {
        const item = new ContextRootTreeItem("/shared/scripts", false, {
            description: "shared/scripts",
            collectionNames: ["first"],
        });

        item.setRootDetails({
            description: "/shared/scripts",
            collectionNames: ["second"],
        });

        expect(item.description).toBe("/shared/scripts");
        expect((item.tooltip as MarkdownString).value).toContain(
            "collection 'second'",
        );
    });

    it("uses the plain folder icon and no command for a folder within a root", () => {
        const item = new ContextRootTreeItem("/shared/scripts/utils", false);

        expect(item.isTopLevel).toBe(false);
        expect(item.contextValue).toBe("contextRootFolder");
        expect((item.iconPath as { id: string }).id).toBe("folder");
        expect(item.command).toBeUndefined();
        expect(item.description).toBeUndefined();
    });

    it("opens a file within a root when clicked", () => {
        const item = new ContextRootTreeItem("/shared/scripts/a.js", true);

        expect(item.contextValue).toBe("contextRootFile");
        expect(item.command).toMatchObject({
            command: "vscode.open",
            arguments: [{ fsPath: "/shared/scripts/a.js" }],
        });
    });
});
