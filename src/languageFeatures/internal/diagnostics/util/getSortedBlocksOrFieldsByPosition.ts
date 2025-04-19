import { Range } from "vscode";

export function getSortedBlocksOrFieldsByPosition<
    T extends { nameRange: Range }
>(unsorted: T[]) {
    return unsorted.slice().sort(
        (
            {
                nameRange: {
                    start: { line: line1 },
                },
            },
            {
                nameRange: {
                    start: { line: line2 },
                },
            }
        ) => line1 - line2
    );
}
