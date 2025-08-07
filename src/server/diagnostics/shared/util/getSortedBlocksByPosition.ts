import { Block } from "../../../../shared";

export function getSortedBlocksByPosition(unsorted: Block[]) {
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
