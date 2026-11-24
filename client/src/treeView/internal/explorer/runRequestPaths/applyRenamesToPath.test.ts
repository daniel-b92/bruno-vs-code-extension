import { describe, it, expect } from "@jest/globals";
import { join } from "path";
import { getPathAfterRenames } from "./getEditsForRunRequestPaths";
import { getPathDepth } from "./applyRenamesToPath";

const root = join("/", "collection");
const p = (path: string) => join(root, path);

describe("getPathAfterRenames", () => {
    it("returns the path if it is not affected", () => {
        expect(
            getPathAfterRenames(p("a.bru"), [
                {
                    sourcePath: p("b.bru"),
                    targetPath: p("c.bru"),
                    isFile: true,
                },
            ]),
        ).toBe(p("a.bru"));
    });

    it("applies the rename of a folder to its descendants", () => {
        expect(
            getPathAfterRenames(p("users/a.bru"), [
                {
                    sourcePath: p("users"),
                    targetPath: p("0010_users"),
                    isFile: false,
                },
            ]),
        ).toBe(p("0010_users/a.bru"));
    });

    it("applies the renames of a nested item and of its folder", () => {
        expect(
            getPathAfterRenames(p("users/a.bru"), [
                {
                    sourcePath: p("users"),
                    targetPath: p("0010_users"),
                    isFile: false,
                },
                {
                    sourcePath: p("users/a.bru"),
                    targetPath: p("users/0005_a.bru"),
                    isFile: true,
                },
            ]),
        ).toBe(p("0010_users/0005_a.bru"));
    });

    it("does not apply the rename of a sibling to the result of another rename", () => {
        const renames = [
            { sourcePath: p("0010_a"), targetPath: p("0020_a"), isFile: true },
            { sourcePath: p("0020_a"), targetPath: p("0030_a"), isFile: true },
        ];

        expect(getPathAfterRenames(p("0010_a"), renames)).toBe(p("0020_a"));
        expect(getPathAfterRenames(p("0020_a"), renames)).toBe(p("0030_a"));
    });
});

describe("getPathDepth", () => {
    it("counts the segments", () => {
        expect(getPathDepth("/a/b/c")).toBe(3);
        expect(getPathDepth("C:\\a\\b")).toBe(3);
    });
});
