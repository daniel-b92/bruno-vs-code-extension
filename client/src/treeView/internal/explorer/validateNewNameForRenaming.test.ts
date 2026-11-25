import { describe, it, expect } from "@jest/globals";
import { join } from "path";
import { useTemporaryDirectories } from "@global_shared/_testingUtils";
import { validateNewNameForRenaming } from "./validateNewNameForRenaming";

describe("validateNewNameForRenaming", () => {
    const createTemporaryDirectory = useTemporaryDirectories();
    const withPrefix = (name: string) => `0010_${name}`;

    it.each(["", "   ", ".bru"])(
        "rejects the empty name '%s'",
        async (name) => {
            const directory = await createTemporaryDirectory({
                "0010_a.bru": "",
            });

            expect(
                await validateNewNameForRenaming(
                    name,
                    join(directory, "0010_a.bru"),
                    withPrefix,
                ),
            ).toBe("The name must not be empty");
        },
    );

    it("accepts a free name", async () => {
        const directory = await createTemporaryDirectory({ "0010_a.bru": "" });

        expect(
            await validateNewNameForRenaming(
                "b.bru",
                join(directory, "0010_a.bru"),
                withPrefix,
            ),
        ).toBeUndefined();
    });

    it("rejects a name that is taken once the prefix is added", async () => {
        const directory = await createTemporaryDirectory({
            "0010_a.bru": "",
            "0010_b.bru": "",
        });

        expect(
            await validateNewNameForRenaming(
                "b.bru",
                join(directory, "0010_a.bru"),
                withPrefix,
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
                "b.bru",
                join(directory, "0010_a.bru"),
                withPrefix,
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
                "b.bru",
                join(directory, "0010_a.bru"),
                withPrefix,
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
                "a.bru",
                join(directory, "0010_a.bru"),
                withPrefix,
                ["a.bru"],
            ),
        ).toBeUndefined();
    });

    it("accepts the unchanged name", async () => {
        const directory = await createTemporaryDirectory({ "0010_a.bru": "" });

        expect(
            await validateNewNameForRenaming(
                "a.bru",
                join(directory, "0010_a.bru"),
                withPrefix,
            ),
        ).toBeUndefined();
    });
});
