import { DiagnosticRelatedInformation, DiagnosticSeverity, Uri } from "vscode";
import {
    DictionaryBlockArrayField,
    mapToVsCodeRange,
    Range,
} from "../../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

interface ValuesForArrayField {
    field: DictionaryBlockArrayField;
    values: {
        content: string;
        range: Range;
    }[];
}

export function checkDictionaryBlockArrayFieldsValues(
    documentUri: Uri,
    fieldsToCheck: DictionaryBlockArrayField[],
): DiagnosticWithCode | undefined {
    const invalidValuesWithFields =
        getInvalidValuesSortedByPosition(fieldsToCheck);

    if (invalidValuesWithFields.length == 0) {
        return undefined;
    }

    return getDiagnostic(documentUri, invalidValuesWithFields);
}

function getDiagnostic(
    documentUri: Uri,
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
                                      uri: documentUri,
                                      range: mapToVsCodeRange(val.range),
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

    return mapToVsCodeRange(
        new Range(
            invalidValuesSortedByPosition[0].values[0].range.start,
            lastInvalidValueForLastField.range.end,
        ),
    );
}
