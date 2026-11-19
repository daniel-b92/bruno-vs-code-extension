import { describe, it, expect } from "@jest/globals";
import { CollectionFormat } from "@global_shared";
import { getRunRequestPathForItem } from "./getRunRequestPathForItem";
import { getUpdatedRunRequestPath } from "./getUpdatedRunRequestPath";

describe("getRunRequestPathForItem", () => {
    it.each([
        [
            CollectionFormat.Bru,
            "/col/users/get-user.bru",
            true,
            "users/get-user",
        ],
        [
            CollectionFormat.Yaml,
            "/col/users/get-user.yml",
            true,
            "users/get-user",
        ],
        [CollectionFormat.Bru, "/col/users/admins", false, "users/admins"],
        [CollectionFormat.Bru, "/col/users/a.bru", false, "users/a.bru"],
        [CollectionFormat.Bru, "/col/get-user.bru", true, "get-user"],
    ])(
        "maps %s item '%s' (file: %s) to '%s'",
        (format, path, isFile, expected) => {
            expect(getRunRequestPathForItem("/col", path, format, isFile)).toBe(
                expected,
            );
        },
    );
});

describe("getUpdatedRunRequestPath", () => {
    const fileRename = {
        oldPath: "users/get-user",
        newPath: "people/get-person",
        isFile: true,
    };
    const folderRename = {
        oldPath: "users",
        newPath: "archive/users",
        isFile: false,
    };

    it("updates a path that is equal to a renamed request", () => {
        expect(
            getUpdatedRunRequestPath("users/get-user", fileRename, ".bru"),
        ).toBe("people/get-person");
    });

    it.each([
        ["a direct child", "users/get-user", "archive/users/get-user"],
        ["a nested descendant", "users/admins/get", "archive/users/admins/get"],
    ])("updates a path to %s of a renamed folder", (_, path, expected) => {
        expect(getUpdatedRunRequestPath(path, folderRename, ".bru")).toBe(
            expected,
        );
    });

    it.each([
        ["a sibling with the same prefix", "users2/get-user"],
        ["the folder itself, which would refer to a file", "users"],
        ["an unrelated request", "other/get-user"],
        ["a request with the same name in another folder", "x/users/get-user"],
    ])("does not update a path to %s", (_, path) => {
        expect(
            getUpdatedRunRequestPath(path, folderRename, ".bru"),
        ).toBeUndefined();
        expect(
            getUpdatedRunRequestPath(path, fileRename, ".bru"),
        ).toBeUndefined();
    });

    it("does not update a path to a request whose name only starts with the old name", () => {
        expect(
            getUpdatedRunRequestPath("users/get-user2", fileRename, ".bru"),
        ).toBeUndefined();
    });

    it.each([
        ["./users/get-user", "./people/get-person"],
        ["/users/get-user", "/people/get-person"],
        ["users/get-user.bru", "people/get-person.bru"],
        ["./users/get-user.BRU", "./people/get-person.BRU"],
    ])("keeps the style of the path '%s'", (path, expected) => {
        expect(getUpdatedRunRequestPath(path, fileRename, ".bru")).toBe(
            expected,
        );
    });

    it("keeps the extension of the collection format for folders", () => {
        expect(
            getUpdatedRunRequestPath(
                "users/get-user.yml",
                folderRename,
                ".yml",
            ),
        ).toBe("archive/users/get-user.yml");
    });

    it("matches case-sensitively, like Bruno", () => {
        expect(
            getUpdatedRunRequestPath("Users/get-user", fileRename, ".bru"),
        ).toBeUndefined();
    });
});
