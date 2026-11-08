import { describe, it, expect } from "@jest/globals";
import { isPathEqualOrDescendant } from "./isPathEqualOrDescendant";

describe("isPathEqualOrDescendant", () => {
    it("returns true for the directory itself, with or without trailing separator", () => {
        expect(isPathEqualOrDescendant("/coll/foo", "/coll/foo")).toBe(true);
        expect(isPathEqualOrDescendant("/coll/foo/", "/coll/foo")).toBe(true);
        expect(isPathEqualOrDescendant("/coll/foo", "/coll/foo/")).toBe(true);
    });

    it("returns true for nested files and directories", () => {
        expect(isPathEqualOrDescendant("/coll/foo/a.bru", "/coll/foo")).toBe(
            true,
        );
        expect(isPathEqualOrDescendant("/coll/foo/bar/baz", "/coll/foo")).toBe(
            true,
        );
    });

    it("returns false for sibling directories sharing the same name prefix", () => {
        expect(isPathEqualOrDescendant("/coll/foobar", "/coll/foo")).toBe(
            false,
        );
        expect(isPathEqualOrDescendant("/coll/foobar/a.bru", "/coll/foo")).toBe(
            false,
        );
        expect(
            isPathEqualOrDescendant("C:\\coll\\foobar\\a.bru", "C:\\coll\\foo"),
        ).toBe(false);
    });

    it("returns false for ancestors of the directory", () => {
        expect(isPathEqualOrDescendant("/coll", "/coll/foo")).toBe(false);
    });

    it("handles Windows paths with differently cased drive letters", () => {
        expect(
            isPathEqualOrDescendant("c:\\coll\\foo\\a.bru", "C:\\coll\\foo"),
        ).toBe(true);
        expect(
            isPathEqualOrDescendant("C:\\coll\\foo\\a.bru", "c:\\coll\\foo"),
        ).toBe(true);
        expect(
            isPathEqualOrDescendant("c:\\coll\\foo", "c:\\coll\\foo\\"),
        ).toBe(true);
    });
});
