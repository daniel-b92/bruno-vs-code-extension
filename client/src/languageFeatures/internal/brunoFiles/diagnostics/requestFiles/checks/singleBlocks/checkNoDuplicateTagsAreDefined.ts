import { DiagnosticSeverity, Uri } from "vscode";
import { DictionaryBlockArrayField, Range } from "@global_shared";
import { mapToVsCodeRange } from "@shared";
import { DiagnosticWithCode } from "../../../definitions";
import { RelevantWithinMetaBlockDiagnosticCode } from "../../../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";

export function checkNoDuplicateTagsAreDefined(
    documentUri: Uri,
    tagsField: DictionaryBlockArrayField,
): DiagnosticWithCode[] | undefined {
    const duplicateValues = getDuplicateValues(tagsField);

    if (duplicateValues.length == 0) {
        return undefined;
    }

    return duplicateValues.map(({ value, ranges }) => {
        const sortedRanges = ranges.slice().sort(compareRanges);

        return {
            message: `Value '${value}' is defined ${ranges.length} times`,
            range: mapToVsCodeRange(sortedRanges[sortedRanges.length - 1]),
            severity: DiagnosticSeverity.Error,
            code: RelevantWithinMetaBlockDiagnosticCode.DuplicateTagsDefined,
            relatedInformation: sortedRanges.slice(0, -1).map((range) => ({
                message: `Previous definition for tag '${value}'`,
                location: {
                    uri: documentUri,
                    range: mapToVsCodeRange(range),
                },
            })),
        };
    });
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

function compareRanges(range1: Range, range2: Range) {
    return range1.start.isBefore(range2.start) ? -1 : 1;
}
