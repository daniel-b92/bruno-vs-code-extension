import { Position } from "./position";
import { Range } from "./range";
import { Position as VsCodePosition, Range as VsCodeRange } from "vscode";

export function mapRange(range: Range): VsCodeRange {
    return new VsCodeRange(mapPosition(range.start), mapPosition(range.end));
}

export function mapPosition(position: Position): VsCodePosition {
    return new VsCodePosition(position.line, position.character);
}
