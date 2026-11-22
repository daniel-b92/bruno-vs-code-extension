import { describe, it, expect } from "@jest/globals";
import { join } from "path";
import { useTemporaryDirectories } from "@global_shared/_testingUtils";
import { getTargetPathForMovingItem } from "./getTargetPathForMovingItem";

describe("getTargetPathForMovingItem", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    it("moves a file into a target folder", async () => {
        const directory = await createTemporaryDirectory({
            "a.js": "",
            "target/.keep": "",
        });

        const result = await getTargetPathForMovingItem(
            join(directory, "a.js"),
            {
                path: join(directory, "target"),
                isFile: false,
            },
        );

        expect(result).toEqual({
            kind: "move",
            newPath: join(directory, "target", "a.js"),
            isFile: true,
        });
    });

    it("uses the parent folder of a target file", async () => {
        const directory = await createTemporaryDirectory({
            "a.js": "",
            "target/b.js": "",
        });

        const result = await getTargetPathForMovingItem(
            join(directory, "a.js"),
            {
                path: join(directory, "target", "b.js"),
                isFile: true,
            },
        );

        expect(result).toMatchObject({
            kind: "move",
            newPath: join(directory, "target", "a.js"),
        });
    });

    it("moves a folder into a target folder", async () => {
        const directory = await createTemporaryDirectory({
            "source/a.js": "",
            "target/.keep": "",
        });

        const result = await getTargetPathForMovingItem(
            join(directory, "source"),
            { path: join(directory, "target"), isFile: false },
        );

        expect(result).toEqual({
            kind: "move",
            newPath: join(directory, "target", "source"),
            isFile: false,
        });
    });

    it("reports no change when the item already is in the target folder", async () => {
        const directory = await createTemporaryDirectory({
            "folder/a.js": "",
            "folder/b.js": "",
        });

        const result = await getTargetPathForMovingItem(
            join(directory, "folder", "a.js"),
            { path: join(directory, "folder", "b.js"), isFile: true },
        );

        expect(result).toEqual({ kind: "unchanged" });
    });

    it("rejects moving a folder to a file", async () => {
        const directory = await createTemporaryDirectory({
            "source/a.js": "",
            "b.js": "",
        });

        const result = await getTargetPathForMovingItem(
            join(directory, "source"),
            { path: join(directory, "b.js"), isFile: true },
        );

        expect(result.kind).toBe("rejected");
    });

    it("rejects moving a folder into itself or a descendant, but not into a folder with a similar name", async () => {
        const directory = await createTemporaryDirectory({
            "source/sub/a.js": "",
            "source-other/.keep": "",
        });
        const source = join(directory, "source");

        const results = [
            await getTargetPathForMovingItem(source, {
                path: source,
                isFile: false,
            }),
            await getTargetPathForMovingItem(source, {
                path: join(source, "sub"),
                isFile: false,
            }),
            await getTargetPathForMovingItem(source, {
                path: join(directory, "source-other"),
                isFile: false,
            }),
        ];

        expect(results.map(({ kind }) => kind)).toEqual([
            "rejected",
            "rejected",
            "move",
        ]);
    });

    it("rejects a source that does not exist", async () => {
        const directory = await createTemporaryDirectory({});

        const result = await getTargetPathForMovingItem(
            join(directory, "missing.js"),
            { path: directory, isFile: false },
        );

        expect(result.kind).toBe("rejected");
    });
});
