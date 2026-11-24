import { describe, it, expect } from "@jest/globals";
import { join } from "path";
import { useTemporaryDirectories } from "@global_shared/_testingUtils";
import { excludeConflictingRenames } from "./excludeConflictingRenames";

describe("excludeConflictingRenames", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    it("keeps renames to free names", async () => {
        const directory = await createTemporaryDirectory({ "a.bru": "" });
        const renames = [rename(directory, "a.bru", "b.bru")];

        expect(await excludeConflictingRenames(renames)).toEqual(renames);
    });

    it("excludes renames to names that are taken by items that stay", async () => {
        const directory = await createTemporaryDirectory({
            "a.bru": "",
            "b.bru": "",
        });

        expect(
            await excludeConflictingRenames([
                rename(directory, "a.bru", "b.bru"),
            ]),
        ).toEqual([]);
    });

    it("keeps renames to names that are taken by items that are renamed as well", async () => {
        const directory = await createTemporaryDirectory({
            "a.bru": "",
            "b.bru": "",
        });
        const renames = [
            rename(directory, "a.bru", "b.bru"),
            rename(directory, "b.bru", "c.bru"),
        ];

        expect(await excludeConflictingRenames(renames)).toEqual(renames);
    });

    it("excludes a rename if the item that should vacate the name is excluded", async () => {
        const directory = await createTemporaryDirectory({
            "a.bru": "",
            "b.bru": "",
            "c.bru": "",
        });

        expect(
            await excludeConflictingRenames([
                rename(directory, "a.bru", "b.bru"),
                rename(directory, "b.bru", "c.bru"),
            ]),
        ).toEqual([]);
    });

    it("only keeps the first of several renames to the same name", async () => {
        const directory = await createTemporaryDirectory({
            "a.bru": "",
            "b.bru": "",
        });
        const first = rename(directory, "a.bru", "c.bru");

        expect(
            await excludeConflictingRenames([
                first,
                rename(directory, "b.bru", "c.bru"),
            ]),
        ).toEqual([first]);
    });

    it("ignores renames to the same path", async () => {
        const directory = await createTemporaryDirectory({ "a.bru": "" });

        expect(
            await excludeConflictingRenames([
                rename(directory, "a.bru", "a.bru"),
            ]),
        ).toEqual([]);
    });
});

function rename(directory: string, from: string, to: string) {
    return {
        sourcePath: join(directory, from),
        targetPath: join(directory, to),
        isFile: true,
    };
}
