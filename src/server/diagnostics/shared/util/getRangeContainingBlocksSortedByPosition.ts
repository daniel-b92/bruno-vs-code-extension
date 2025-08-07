import { Block, mapPosition, Range } from "../../../../shared";

export function getRangeContainingBlocksSortedByPosition(
    blocksSortedByPosition: Block[],
): Range {
    return new Range(
        mapPosition(blocksSortedByPosition[0].nameRange.start),
        mapPosition(
            blocksSortedByPosition[blocksSortedByPosition.length - 1].nameRange
                .end,
        ),
    );
}
