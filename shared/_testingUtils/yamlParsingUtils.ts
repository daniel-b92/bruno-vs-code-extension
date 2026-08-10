import { Position, Range } from "..";

export function getExpectedKeyRange(
    line: number,
    key: string,
    keyStartChar = 4,
) {
    return new Range(
        new Position(line, keyStartChar),
        new Position(line, keyStartChar + key.length),
    );
}

export function getExpectedSameLineValueRange(
    line: number,
    key: string,
    value: string,
    keyStartChar = 4,
) {
    return new Range(
        // The '+2' is for the ': ' between the key and the value.
        new Position(line, keyStartChar + key.length + 2),
        new Position(line, keyStartChar + key.length + 2 + value.length),
    );
}
