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

    it("shows the sequence 0 in the description and tooltip", () => {
        const item = new BrunoTreeItem("/collection/folder", false, false, 0);

        expect(item.description).toBe("seq: 0");
        expect((item.tooltip as vscode.MarkdownString).value).toBe(
            "folder (seq: 0)",
        );
    });

    describe("label", () => {
        afterEach(() => {
            jest.restoreAllMocks();
        });

        it.each([true, false])(
            "is the full file name, including the sequence prefix, if prefixing names with sequences is enabled: %s",
            (prefixNames) => {
                mockVsCodeSettings({
                    "bru-as-code.prefixNamesWithSequence": prefixNames,
                });

                const item = new BrunoTreeItem(
                    "/collection/00010_get-token.bru",
                    true,
                    false,
                    10,
                );

                expect(item.label).toBe("00010_get-token.bru");
                expect((item.tooltip as vscode.MarkdownString).value).toBe(
                    "00010_get-token.bru (seq: 10)",
                );
            },
        );
    });
});
