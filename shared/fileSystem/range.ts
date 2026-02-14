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
}
