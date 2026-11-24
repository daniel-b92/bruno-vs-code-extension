import { normalizePath } from "@global_shared";
import { getPathDepth } from "./runRequestPaths/applyRenamesToPath";

export interface RenameStep {
    from: string;
    to: string;
}

const temporarySuffix = ".bru-as-code-rename";

/**
 * Determines an order in which the renames can be executed one after another without overwriting an item that still has to be renamed itself:
 * - Items within other renamed folders are renamed first, since their paths would change with the rename of the folder.
 * - If a name that is needed is still taken by an item that will be renamed as well (e.g. when shifting items by one), the item that takes it goes first.
 * - If items would swap their names, one of them is moved to a temporary name first.
 *
 * The target paths must be distinct.
 */
export function getRenameStepsInExecutionOrder(
    renames: RenameStep[],
): RenameStep[] {
    const steps: RenameStep[] = [];
    const depths = Array.from(
        new Set(renames.map(({ from }) => getPathDepth(from))),
    ).sort((a, b) => b - a);

    for (const depth of depths) {
        let remaining = renames.filter(
            ({ from }) => getPathDepth(from) == depth,
        );
        const movedAside = new Set<RenameStep>();

        while (remaining.length > 0) {
            const next = remaining.find(
                ({ to }) =>
                    !remaining.some(
                        ({ from }) => normalizePath(from) == normalizePath(to),
                    ),
            );

            if (next) {
                steps.push(next);
                remaining = remaining.filter((rename) => rename !== next);
                continue;
            }

            // Every remaining item waits for another one, so they form cycles.
            const [first] = remaining;

            if (movedAside.has(first)) {
                // Only happens for target paths that are not distinct.
                break;
            }

            const temporaryPath = `${first.from}${temporarySuffix}`;
            const moved = { from: temporaryPath, to: first.to };

            steps.push({ from: first.from, to: temporaryPath });
            movedAside.add(moved);
            remaining = remaining.map((rename) =>
                rename === first ? moved : rename,
            );
        }
    }

    return steps;
}

/**
 * Splits the steps (in execution order) into groups that can each be applied with one workspace edit.
 *
 * VS Code checks the targets of all consecutive renames of a workspace edit before it executes any of them.
 * So a step must not be in the same group as an earlier step that frees its target or that creates its source.
 */
export function splitStepsIntoGroupsWithoutDependencies(
    steps: RenameStep[],
): RenameStep[][] {
    const groups: RenameStep[][] = [];
    let current: RenameStep[] = [];

    for (const step of steps) {
        const from = normalizePath(step.from);
        const to = normalizePath(step.to);

        if (
            current.some(
                (other) =>
                    normalizePath(other.from) == to ||
                    normalizePath(other.to) == from,
            )
        ) {
            groups.push(current);
            current = [];
        }

        current.push(step);
    }

    if (current.length > 0) {
        groups.push(current);
    }

    return groups;
}
