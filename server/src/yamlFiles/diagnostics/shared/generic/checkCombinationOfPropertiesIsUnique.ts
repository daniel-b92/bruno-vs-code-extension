import { Range } from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { URI } from "vscode-uri";

export function checkCombinationOfPropertiesIsUnique(
    filePath: string,
    entries: { values: string[]; range: Range }[],
    propertyNamesForMessage: string[],
): (Diagnostic | undefined)[] {
    const groupedByValues = entries.reduce(
        (prev, { values, range }) => {
            const matching = prev.find(({ values: otherValues }) =>
                values.every((value, index) => value == otherValues[index]),
            );

            if (matching) {
                matching.ranges.push(range);
                return prev;
            }
            return prev.concat({ values, ranges: [range] });
        },
        [] as { values: string[]; ranges: Range[] }[],
    );

    return groupedByValues.map(({ values, ranges }) => {
        if (ranges.length <= 1) {
            return undefined;
        }
        const sortedRanges = sortByPosition(ranges.slice());

        return {
            message: `Same ${
                propertyNamesForMessage.length == 1
                    ? propertyNamesForMessage[0]
                    : `combination of ${propertyNamesForMessage.join(", ")}`
            } already defined`,
            range: sortedRanges[sortedRanges.length - 1],
            severity: DiagnosticSeverity.Warning,
            relatedInformation: sortedRanges.slice(0, -1).map((range) => ({
                message: `Other definition for ${propertyNamesForMessage
                    .map((name, index) => `${name} '${values[index]}'`)
                    .join(", ")}`,
                location: {
                    uri: URI.file(filePath).toString(),
                    range,
                },
            })),
        };
    });
}

function sortByPosition(ranges: Range[]) {
    return ranges.sort((a, b) => (a.start.isBefore(b.start) ? -1 : 1));
}
