import { Position } from "./position";

export class Range {
    constructor(
        readonly start: Position,
        readonly end: Position,
    ) {}

    public contains(position: Position) {
        return (
            (this.start.isBefore(position) || this.start.equals(position)) &&
            (position.isBefore(this.end) || position.equals(this.end))
        );
    }

    public equals(range: Range) {
        return this.start.equals(range.start) && this.end.equals(range.end);
    }

    public withPositions(positions: {
        startLine?: number;
        startChar?: number;
        endLine?: number;
        endChar?: number;
    }) {
        const { startLine, startChar, endLine, endChar } = positions;
        return new Range(
            new Position(
                startLine ?? this.start.line,
                startChar ?? this.start.character,
            ),
            new Position(
                endLine ?? this.end.line,
                endChar ?? this.end.character,
            ),
        );
    }
}
