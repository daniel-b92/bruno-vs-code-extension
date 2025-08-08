import { DictionaryBlockField } from "../../../../../shared";

export function getSortedDictionaryBlockFieldsByPosition(
    unsorted: DictionaryBlockField[],
) {
    return unsorted.slice().sort(
        (
            {
                keyRange: {
                    start: { line: line1 },
                },
            },
            {
                keyRange: {
                    start: { line: line2 },
                },
            },
        ) => line1 - line2,
    );
}
