import { DiagnosticSeverity, Uri, Range as VsCodeRange } from "vscode";
import {
    DictionaryBlockArrayField,
    mapToVsCodePosition,
    mapToVsCodeRange,
    Range,
} from "../../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { RelevantWithinMetaBlockDiagnosticCode } from "../../../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";

export function checkNoDuplicateTagsAreDefined(
    documentUri: Uri,
    tagsField: DictionaryBlockArrayField,
): DiagnosticWithCode | undefined {
    const duplicateValues = getDuplicateValues(tagsField);

    if (duplicateValues.length == 0) {
        return undefined;
    }

    return {
        message: `Some values are defined multiple times: '${duplicateValues
            .map(({ value }) => value)
            .join("', '")}'.`,
        range: getRangeForDuplicateTagsDiagnostic(duplicateValues),
        severity: DiagnosticSeverity.Error,
        code: RelevantWithinMetaBlockDiagnosticCode.DuplicateTagsDefined,
        relatedInformation: duplicateValues
            .map(({ value, ranges }) => ({
                value,
                ranges: ranges.sort(compareRanges).slice(0, -1),
            }))
            .flatMap(({ value, ranges }) =>
                ranges.map((range) => ({
                    message: `Previous definition for tag '${value}'`,
                    location: {
                        uri: documentUri,
                        range: mapToVsCodeRange(range),
                    },
                })),
            ),
    };
}

function getDuplicateValues(tagsField: DictionaryBlockArrayField) {
    return tagsField.values.reduce(
        (prev, { content, range }, index) => {
            const indexForEntryForSameValue = tagsField.values
                .slice(0, index)
                .findIndex(
                    ({ content: prevEntryValue }) => content == prevEntryValue,
                );

            if (indexForEntryForSameValue < 0) {
                return prev;
            }

            const indexForEntryFromResult = prev.findIndex(
                ({ value: prevEntryValue }) => content == prevEntryValue,
            );

            return indexForEntryFromResult >= 0
                ? prev.map((val, index) =>
                      index == indexForEntryForSameValue
                          ? { ...val, ranges: val.ranges.concat(range) }
                          : val,
                  )
                : prev.concat({
                      value: content,
                      ranges: [
                          tagsField.values[indexForEntryForSameValue].range,
                          range,
                      ],
                  });
        },
        [] as { value: string; ranges: Range[] }[],
    );
}

function getRangeForDuplicateTagsDiagnostic(
    duplicateValues: { value: string; ranges: Range[] }[],
) {
    const onlyLatestRangesSortedByPostion = duplicateValues
        .map(({ value, ranges }) => ({
            value,
            range: ranges.sort(compareRanges).slice(-1)[0],
        }))
        .sort(({ range: range1 }, { range: range2 }) =>
            compareRanges(range1, range2),
        );

    return new VsCodeRange(
        mapToVsCodePosition(onlyLatestRangesSortedByPostion[0].range.start),
        mapToVsCodePosition(
            onlyLatestRangesSortedByPostion.slice(-1)[0].range.end,
        ),
    );
}

function compareRanges(range1: Range, range2: Range) {
    return range1.start.isBefore(range2.start) ? -1 : 1;
}
