import {
    DictionaryBlock,
    DictionaryBlockArrayField,
    DictionaryBlockSimpleField,
    isDictionaryBlockArrayField,
    Range,
} from "@global_shared";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { DiagnosticSeverity } from "vscode-languageserver";

export function checkDictionaryBlockArrayFieldsStructure(
    filePath: string,
    block: DictionaryBlock,
    keysToCheck: string[],
): DiagnosticWithCode | undefined {
    const invalidFieldsSortedByPosition = getInvalidFieldsSortedByPosition(
        block,
        keysToCheck,
    );

    if (invalidFieldsSortedByPosition.length == 0) {
        return undefined;
    }

    return getDiagnostic(filePath, invalidFieldsSortedByPosition);
}

function getDiagnostic(
    filePath: string,
    invalidFieldsSortedByPosition: (
        | DictionaryBlockSimpleField
        | DictionaryBlockArrayField
    )[],
): DiagnosticWithCode {
    return {
        message: `Some dictionary block array fields do not have the correct structure. A dictionary block with only array fields matches the following pattern:
<blockName> {
  arrayKey: [
    arrVal1
    arrVal2
  ]
}}`,
        range: getRange(invalidFieldsSortedByPosition),
        relatedInformation:
            invalidFieldsSortedByPosition.length > 1
                ? invalidFieldsSortedByPosition.map(({ key, keyRange }) => ({
                      message: `Invalid field '${key}'`,
                      location: {
                          uri: filePath,
                          range: keyRange,
                      },
                  }))
                : undefined,
        severity: DiagnosticSeverity.Error,
        code: NonBlockSpecificDiagnosticCode.ArrayFieldsInDictionaryBlocksNotStructuredCorrectly,
    };
}

function getInvalidFieldsSortedByPosition(
    block: DictionaryBlock,
    keysToCheck: string[],
) {
    const invalidFields = block.content.filter(
        (field) =>
            keysToCheck.includes(field.key) &&
            !field.disabled &&
            (!isDictionaryBlockArrayField(field) ||
                field.arrayRange.end == undefined),
    );

    return invalidFields.sort(
        ({ keyRange: keyRangeA }, { keyRange: keyRangeB }) =>
            keyRangeA.start.line - keyRangeB.start.line,
    );
}

function getRange(
    invalidFieldsSortedByPosition: (
        | DictionaryBlockSimpleField
        | DictionaryBlockArrayField
    )[],
) {
    return new Range(
        invalidFieldsSortedByPosition[0].keyRange.start,
        invalidFieldsSortedByPosition[invalidFieldsSortedByPosition.length - 1]
            .keyRange.end,
    );
}
