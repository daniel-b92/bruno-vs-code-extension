import { describe, it, expect } from "@jest/globals";
import * as vscode from "vscode";
import { BrunoTreeItem } from "./brunoTreeItem";

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
});
