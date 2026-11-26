import { describe, it, expect } from "@jest/globals";
import { join } from "path";
import { useTemporaryDirectories } from "@global_shared/_testingUtils";
import {
    removeEnteredSequencePrefix,
    validateNewNameForRenaming,
} from "./validateNewNameForRenaming";

describe("validateNewNameForRenaming", () => {
    const createTemporaryDirectory = useTemporaryDirectories();
    const prefix = "0010_";

    it.each(["", "   ", ".bru", "0010_", "0010_.bru"])(
        "rejects the empty name '%s'",
        async (name) => {
            const directory = await createTemporaryDirectory({
                "0010_a.bru": "",
            });

            expect(
                await validateNewNameForRenaming(
                    name,
                    join(directory, "0010_a.bru"),
                    prefix,
                ),
            ).toBe("The name must not be empty");
        },
    );

    it.each(["0010_sub/b.bru", "0010_sub\\b.bru", "0010_../b.bru"])(
        "rejects the name '%s' with a path separator",
        async (name) => {
            const directory = await createTemporaryDirectory({
                "0010_a.bru": "",
                "0010_sub/c.bru": "",
            });

            expect(
                await validateNewNameForRenaming(
                    name,
                    join(directory, "0010_a.bru"),
                    prefix,
                ),
            ).toBe("The name must not contain '/' or '\\'");
        },
    );

    it.each(["b.bru", "0020_b.bru", "010_b.bru"])(
        "rejects the name '%s' without the unchanged prefix",
        async (name) => {
            const directory = await createTemporaryDirectory({
                "0010_a.bru": "",
            });

            expect(
                await validateNewNameForRenaming(
                    name,
                    join(directory, "0010_a.bru"),
                    prefix,
                ),
            ).toContain("The prefix '0010_' must be kept");
        },
    );

    it("accepts a free name", async () => {
        const directory = await createTemporaryDirectory({ "0010_a.bru": "" });

        expect(
            await validateNewNameForRenaming(
                "0010_b.bru",
                join(directory, "0010_a.bru"),
                prefix,
            ),
        ).toBeUndefined();
    });

    it("accepts a name that starts with digits after the prefix", async () => {
        const directory = await createTemporaryDirectory({ "0010_a.bru": "" });

        expect(
            await validateNewNameForRenaming(
                "0010_404_not-found.bru",
                join(directory, "0010_a.bru"),
                prefix,
                ["404.bru"],
            ),
        ).toBeUndefined();
    });

    it("accepts any name for items without a prefix", async () => {
        const directory = await createTemporaryDirectory({ "a.bru": "" });

        expect(
            await validateNewNameForRenaming(
                "0020_b.bru",
                join(directory, "a.bru"),
            ),
        ).toBeUndefined();
    });

    it("rejects a name that is already taken", async () => {
        const directory = await createTemporaryDirectory({
            "0010_a.bru": "",
            "0010_b.bru": "",
        });

        expect(
            await validateNewNameForRenaming(
                "0010_b.bru",
                join(directory, "0010_a.bru"),
                prefix,
            ),
        ).toBe("File with name '0010_b.bru' already exists");
    });

    it("rejects a name that only differs in the prefix from the one of a sibling", async () => {
        const directory = await createTemporaryDirectory({
            "0010_a.bru": "",
            "0020_b.bru": "",
        });

        expect(
            await validateNewNameForRenaming(
                "0010_b.bru",
                join(directory, "0010_a.bru"),
                prefix,
                ["b.bru"],
            ),
        ).toContain("already exists");
    });

    it("rejects a name that only differs in the prefix and the case from the one of a sibling", async () => {
        const directory = await createTemporaryDirectory({
            "0010_a.bru": "",
            "0020_B.bru": "",
        });

        expect(
            await validateNewNameForRenaming(
                "0010_b.bru",
                join(directory, "0010_a.bru"),
                prefix,
                ["B.bru"],
            ),
        ).toContain("'B.bru' already exists");
    });

    it("accepts the unchanged name even if a sibling only differs in the prefix", async () => {
        const directory = await createTemporaryDirectory({
            "0010_a.bru": "",
            "0020_a.bru": "",
        });

        expect(
            await validateNewNameForRenaming(
                "0010_a.bru",
                join(directory, "0010_a.bru"),
                prefix,
                ["a.bru"],
            ),
        ).toBeUndefined();
    });

    it("accepts the unchanged name", async () => {
        const directory = await createTemporaryDirectory({ "0010_a.bru": "" });

        expect(
            await validateNewNameForRenaming(
                "0010_a.bru",
                join(directory, "0010_a.bru"),
                prefix,
            ),
        ).toBeUndefined();
    });
});

describe("removeEnteredSequencePrefix", () => {
    it.each([
        ["0010_b.bru", "0010_", "b.bru"],
        ["0010_404_not-found.bru", "0010_", "404_not-found.bru"],
        ["0020_b.bru", "0010_", "0020_b.bru"],
        ["0010_b.bru", undefined, "0010_b.bru"],
    ])(
        "returns the name without the prefix for '%s' and the prefix '%s'",
        (name, prefix, expected) => {
            expect(removeEnteredSequencePrefix(name, prefix)).toBe(expected);
        },
    );
});
