import { isPathEqualOrDescendant, normalizePath } from "@global_shared";
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
 * It also determines the new locations of open files with unsaved changes separately for each rename, based on their paths before all of them.
 * So a folder must not be in the same group as an item within it either. Otherwise, the unsaved changes would end up at paths that do not exist.
 */
export function splitStepsIntoGroupsWithoutDependencies(
    steps: RenameStep[],
): RenameStep[][] {
    const groups: RenameStep[][] = [];
    let current: RenameStep[] = [];

    for (const step of steps) {
        if (current.some((other) => areStepsDependent(other, step))) {
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

/** Whether a path of one step is the same as, or located within, a path of the other one. */
function areStepsDependent(first: RenameStep, second: RenameStep) {
    return [first.from, first.to].some((firstPath) =>
        [second.from, second.to].some(
            (secondPath) =>
                isPathEqualOrDescendant(firstPath, secondPath) ||
                isPathEqualOrDescendant(secondPath, firstPath),
        ),
    );
}
