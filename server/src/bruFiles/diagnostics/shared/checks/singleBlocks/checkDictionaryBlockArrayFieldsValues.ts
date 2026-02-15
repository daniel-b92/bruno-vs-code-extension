import { DictionaryBlockArrayField, Range } from "@global_shared";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import {
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
} from "vscode-languageserver";

interface ValuesForArrayField {
    field: DictionaryBlockArrayField;
    values: {
        content: string;
        range: Range;
    }[];
}

export function checkDictionaryBlockArrayFieldsValues(
    filePath: string,
    fieldsToCheck: DictionaryBlockArrayField[],
): DiagnosticWithCode | undefined {
    const invalidValuesWithFields =
        getInvalidValuesSortedByPosition(fieldsToCheck);

    if (invalidValuesWithFields.length == 0) {
        return undefined;
    }

    return getDiagnostic(filePath, invalidValuesWithFields);
}

function getDiagnostic(
    filePath: string,
    invalidValuesSortedByPosition: ValuesForArrayField[],
): DiagnosticWithCode {
    return {
        message: `Invalid value(s) for Dictionary block array field(s). Allowed characters are:
- alpha-numeric characters
- characters '-' and '_'`,
        range: getRange(invalidValuesSortedByPosition),
        relatedInformation:
            invalidValuesSortedByPosition.length > 1 ||
            invalidValuesSortedByPosition[0].values.length > 1
                ? invalidValuesSortedByPosition.reduce(
                      (prev, curr) =>
                          prev.concat(
                              curr.values.map((val) => ({
                                  message: `Invalid value for '${curr.field.key}'`,
                                  location: {
                                      uri: filePath,
                                      range: val.range,
                                  },
                              })),
                          ),
                      [] as DiagnosticRelatedInformation[],
                  )
                : undefined,
        severity: DiagnosticSeverity.Error,
        code: NonBlockSpecificDiagnosticCode.InvalidValuesForArrayFieldsInDictionaryBlocks,
    };
}

function getInvalidValuesSortedByPosition(
    fieldsToCheck: DictionaryBlockArrayField[],
) {
    const invalidValuesWithFields = fieldsToCheck
        .map((field) => ({ field, values: field.values }))
        .reduce(
            (prev, curr) => {
                const invalidValues = curr.values
                    .filter(
                        ({ content }) => !content.match(/^[a-zA-Z0-9\-_]*$/),
                    )
                    .sort(({ range: rangeA }, { range: rangeB }) =>
                        rangeA.start.isBefore(rangeB.start) ? -1 : 1,
                    );

                return invalidValues.length > 0
                    ? prev.concat({ field: curr.field, values: invalidValues })
                    : prev;
            },
            [] as unknown as ValuesForArrayField[],
        );

    return invalidValuesWithFields.sort(
        (
            { field: { keyRange: keyRangeA } },
            { field: { keyRange: keyRangeB } },
        ) => keyRangeA.start.line - keyRangeB.start.line,
    );
}

function getRange(invalidValuesSortedByPosition: ValuesForArrayField[]) {
    const lastInvalidField =
        invalidValuesSortedByPosition[invalidValuesSortedByPosition.length - 1];
    const lastInvalidValueForLastField =
        lastInvalidField.values[lastInvalidField.values.length - 1];

    return new Range(
        invalidValuesSortedByPosition[0].values[0].range.start,
        lastInvalidValueForLastField.range.end,
    );
}
