import { TextOutsideOfBlocks } from "../../../../../../shared";

export function getSortedTextOutsideOfBlocksByPosition(
    unsorted: TextOutsideOfBlocks[],
) {
    return unsorted
        .slice()
        .sort(
            ({ range: { start: start1 } }, { range: { start: start2 } }) =>
                start1.line - start2.line,
        );
}
