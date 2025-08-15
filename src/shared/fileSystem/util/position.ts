export class Position {
    constructor(
        readonly line: number,
        readonly character: number,
    ) {}

    public equals(other: Position) {
        return other.line == this.line && other.character == this.character;
    }
}
