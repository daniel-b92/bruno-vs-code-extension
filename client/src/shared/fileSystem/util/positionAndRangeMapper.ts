import { Position } from "../../../../../shared/fileSystem/position";
import { Range } from "../../../../../shared/fileSystem/range";
import { Position as VsCodePosition, Range as VsCodeRange } from "vscode";

export function mapToVsCodeRange(range: Range): VsCodeRange {
    return new VsCodeRange(
        mapToVsCodePosition(range.start),
        mapToVsCodePosition(range.end),
    );
}

export function mapToVsCodePosition(position: Position): VsCodePosition {
    return new VsCodePosition(position.line, position.character);
}

export function mapFromVsCodePosition(position: VsCodePosition): Position {
    return new Position(position.line, position.character);
}
