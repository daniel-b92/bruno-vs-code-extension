export class Range {
    constructor(readonly start: Position, readonly end: Position) {}
}

export interface Position {
    line: number;
    character: number;
}
