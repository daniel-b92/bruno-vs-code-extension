import { Range as VsCodeRange } from "vscode";
import { getCorrespondingPositionInSourceFile } from "./getCorrespondingPositionInSourceFile";
import {
    mapFromVsCodePosition,
    mapToVsCodeRange,
    Range,
} from "../../../../shared";

export function getCorrespondingRangeInSourceFile(
    rangeInTempJsFile: VsCodeRange,
) {
    return mapToVsCodeRange(
        new Range(
            getCorrespondingPositionInSourceFile(
                mapFromVsCodePosition(rangeInTempJsFile.start),
            ),
            getCorrespondingPositionInSourceFile(
                mapFromVsCodePosition(rangeInTempJsFile.end),
            ),
        ),
    );
}
