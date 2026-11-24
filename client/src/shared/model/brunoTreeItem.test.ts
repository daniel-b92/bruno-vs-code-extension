import { describe, it, expect, jest, afterEach } from "@jest/globals";
import * as vscode from "vscode";
import { BrunoTreeItem } from "./brunoTreeItem";
import { mockVsCodeSettings } from "../../_testingUtils";

describe("BrunoTreeItem", () => {
    it("uses the given icon", () => {
        const icon = new vscode.ThemeIcon("arrow-swap");

        const item = new BrunoTreeItem(
            "/collection/request.bru",
            true,
            false,
            undefined,
            undefined,
            icon,
        );

        expect(item.iconPath).toBe(icon);
    });

    it.each([
        ["file", true, vscode.ThemeIcon.File],
        ["folder", false, vscode.ThemeIcon.Folder],
    ])(
        "uses the theme icon for a %s without a custom icon",
        (_, isFile, expectedIcon) => {
            const item = new BrunoTreeItem("/collection/item", isFile, false);

            expect(item.iconPath).toBe(expectedIcon);
        },
    );

    it("sets the resource URI, so that the icon theme can derive the icon from the file name", () => {
        const item = new BrunoTreeItem("/collection/script.js", true, false);

        expect((item.resourceUri as vscode.Uri).path).toBe(
            "/collection/script.js",
        );
    });

    describe("label", () => {
        afterEach(() => {
            jest.restoreAllMocks();
        });

        it("does not contain the sequence prefix if names are prefixed with sequences", () => {
            mockVsCodeSettings({ "bru-as-code.prefixNamesWithSequence": true });
            const item = createItem("0010_get-token.bru", true);

            item.updateLabel();

            expect(item.label).toBe("get-token.bru");
            expect(`${item.tooltip?.valueOf()}`).not.toContain("0010_");
        });

        it("is the file name if names are not prefixed with sequences", () => {
            mockVsCodeSettings({});
            const item = createItem("0010_get-token.bru", true);

            item.updateLabel();

            expect(item.label).toBe("0010_get-token.bru");
        });

        it("follows changes of the setting", () => {
            const item = createItem("0010_get-token.bru", true);

            mockVsCodeSettings({ "bru-as-code.prefixNamesWithSequence": true });
            item.updateLabel();
            expect(item.label).toBe("get-token.bru");

            mockVsCodeSettings({});
            item.updateLabel();
            expect(item.label).toBe("0010_get-token.bru");
        });

        it("keeps the file name for items that cannot have a sequence prefix", () => {
            mockVsCodeSettings({ "bru-as-code.prefixNamesWithSequence": true });
            const item = createItem("2024_report.json", false);

            item.updateLabel();

            expect(item.label).toBe("2024_report.json");
        });
    });
});

function createItem(name: string, canHaveSequencePrefix: boolean) {
    return new BrunoTreeItem(
        `/collection/${name}`,
        true,
        false,
        10,
        undefined,
        undefined,
        canHaveSequencePrefix,
    );
}
