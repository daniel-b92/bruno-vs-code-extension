export class Position {
    constructor(
        readonly line: number,
        readonly character: number,
    ) {}

    public equals(other: Position) {
        return other.line == this.line && other.character == this.character;
    }

    public isBefore(other: Position) {
        return (
            this.line < other.line ||
            (this.line == other.line && this.character < other.character)
        );
    }

    public isAfter(other: Position) {
        return (
            this.line > other.line ||
            (this.line == other.line && this.character > other.character)
        );
    }
}
