import { Block, Range } from "../../../../../../shared";

export function getRangeContainingBlocksSortedByPosition(
    blocksSortedByPosition: Block[],
): Range {
    return new Range(
        blocksSortedByPosition[0].nameRange.start,
        blocksSortedByPosition[blocksSortedByPosition.length - 1].nameRange.end,
    );
}
