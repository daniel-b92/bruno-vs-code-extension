import { Range, WithKeyAndValueRange } from "@global_shared";
import { Diagnostic } from "vscode-languageserver";
import { CommonDiagnosticParams } from "../../interfaces";
import { URI } from "vscode-uri";

export function checkVariableNamesAreUnique(
    variables: {
        properties: {
            name?: WithKeyAndValueRange<string>;
        };
    }[],
    { filePath }: CommonDiagnosticParams,
): (Diagnostic | undefined)[] {
    const groupedByName = variables.reduce(
        (prev, { properties: { name: currentNameField } }) => {
            if (!currentNameField) {
                return prev;
            }

            const { value: currentName, valueRange: currentRange } =
                currentNameField;
            const matchingIndex = prev.findIndex(
                ({ name }) => name == currentName,
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
                name: currentName,
                ranges: [currentRange],
            });
        },
        [] as { name: string; ranges: Range[] }[],
    );

    return groupedByName.map(({ name, ranges }) => {
        if (ranges.length <= 1) {
            return undefined;
        }
        const sortedFieldsByPosition = sortByPosition(ranges.slice());

        return {
            message: "Same name already defined",
            range: sortedFieldsByPosition[sortedFieldsByPosition.length - 1],
            relatedInformation: sortedFieldsByPosition
                .slice(0, -1)
                .map((range) => ({
                    message: `Other definition for name '${name}'`,
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
