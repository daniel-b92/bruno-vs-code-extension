import { Range, WithKeyAndValueRange } from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { URI } from "vscode-uri";

export function checkPropertiesAreUnique<T>(
    filePath: string,
    properties: WithKeyAndValueRange<T>[],
    propertyName: string,
): (Diagnostic | undefined)[] {
    const groupedByName = properties.reduce(
        (prev, currentPropField) => {
            if (!currentPropField) {
                return prev;
            }

            const { value: currentValue, valueRange: currentRange } =
                currentPropField;
            const matchingIndex = prev.findIndex(
                ({ property: name }) => name == currentValue,
            );

            if (matchingIndex >= 0) {
                return prev.map((val, index) =>
                    index != matchingIndex
                        ? val
                        : {
                              ...val,
                              ranges: val.ranges.concat(currentRange),
                          },
                );
            }

            return prev.concat({
                property: currentValue,
                ranges: [currentRange],
            });
        },
        [] as { property: T; ranges: Range[] }[],
    );

    return groupedByName.map(({ property: name, ranges }) => {
        if (ranges.length <= 1) {
            return undefined;
        }
        const sortedFieldsByPosition = sortByPosition(ranges.slice());

        return {
            message: `Same ${propertyName} already defined`,
            range: sortedFieldsByPosition[sortedFieldsByPosition.length - 1],
            severity: DiagnosticSeverity.Warning,
            relatedInformation: sortedFieldsByPosition
                .slice(0, -1)
                .map((range) => ({
                    message: `Other definition for ${propertyName} '${name}'`,
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
