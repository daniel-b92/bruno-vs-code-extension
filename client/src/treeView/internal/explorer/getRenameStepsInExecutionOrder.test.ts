import { describe, it, expect } from "@jest/globals";
import { join } from "path";
import { getRenameStepsInExecutionOrder } from "./getRenameStepsInExecutionOrder";

const dir = join("/", "collection");
const step = (from: string, to: string) => ({
    from: join(dir, from),
    to: join(dir, to),
});

describe("getRenameStepsInExecutionOrder", () => {
    it("returns independent renames unchanged", () => {
        const renames = [step("a", "x"), step("b", "y")];

        expect(getRenameStepsInExecutionOrder(renames)).toEqual(renames);
    });

    it("renames an item first whose name is needed by another one", () => {
        expect(
            getRenameStepsInExecutionOrder([
                step("0005_a", "0010_a"),
                step("0010_a", "0020_a"),
                step("0020_a", "0030_a"),
            ]),
        ).toEqual([
            step("0020_a", "0030_a"),
            step("0010_a", "0020_a"),
            step("0005_a", "0010_a"),
        ]);
    });

    it("moves one item to a temporary name if items swap their names", () => {
        const steps = getRenameStepsInExecutionOrder([
            step("0010_a", "0020_a"),
            step("0020_a", "0010_a"),
        ]);

        expect(steps).toHaveLength(3);
        expect(simulate(steps, ["0010_a", "0020_a"])).toEqual([
            "0010_a",
            "0020_a",
        ]);
        // The second item (formerly the first one) was moved aside.
        const [aside, , last] = steps;
        expect(aside.to).not.toBe(join(dir, "0020_a"));
        expect(last.from).toBe(aside.to);
    });

    it("renames items within a folder before the folder itself", () => {
        const steps = getRenameStepsInExecutionOrder([
            step("users", "0020_users"),
            step("users/a.bru", "users/0010_a.bru"),
        ]);

        expect(steps).toEqual([
            step("users/a.bru", "users/0010_a.bru"),
            step("users", "0020_users"),
        ]);
    });

    it("does not loop forever if target paths are not distinct", () => {
        expect(
            getRenameStepsInExecutionOrder([
                step("a", "b"),
                step("b", "c"),
                step("c", "b"),
            ]).length,
        ).toBeLessThan(10);
    });
});

/** Executes the steps on a set of existing items and fails if an item would be overwritten. */
function simulate(steps: { from: string; to: string }[], names: string[]) {
    const existing = new Set(names.map((name) => join(dir, name)));

    for (const { from, to } of steps) {
        expect(existing.has(from)).toBe(true);
        expect(existing.has(to)).toBe(false);
        existing.delete(from);
        existing.add(to);
    }

    return Array.from(existing)
        .map((path) => path.substring(dir.length + 1))
        .sort();
}
