import { Diagnostic, DiagnosticSeverity, Range } from "vscode";
import { DictionaryBlockField, DictionaryBlock } from "../../../../../shared";
import { DiagnosticCode } from "../../diagnosticCodeEnum";
import { getUnknownKeysFromDictionaryBlock } from "../../util/getUnknownKeysFromDictionaryBlock";
import { getSortedDictionaryBlockFieldsByPosition } from "../../util/getSortedDictionaryBlockFieldsByPosition";

export function checkNoUnknownKeysAreDefinedInDictionaryBlock(
    block: DictionaryBlock,
    expectedKeys: string[],
    diagnosticCode: DiagnosticCode
): Diagnostic | DiagnosticCode {
    const unknownKeys = getUnknownKeysFromDictionaryBlock(block, expectedKeys);

    if (unknownKeys.length > 0) {
        return getDiagnostic(unknownKeys, diagnosticCode, expectedKeys);
    } else {
        return diagnosticCode;
    }
}

function getDiagnostic(
    unknownFields: DictionaryBlockField[],
    diagnosticCode: DiagnosticCode,
    expectedKeys: string[]
) {
    const sortedFields =
        getSortedDictionaryBlockFieldsByPosition(unknownFields);

    return {
        message: `${
            sortedFields.length == 1
                ? `Unknown key '${sortedFields[0].key}'.`
                : `Unknown keys are defined: '${sortedFields
                      .map(({ key }) => key)
                      .join("', '")}'.`
        } Allowed keys are ${JSON.stringify(expectedKeys, null, 2)}.`,
        range: getRange(sortedFields),
        severity: DiagnosticSeverity.Error,
        code: diagnosticCode,
    };
}

function getRange(sortedUnknownFields: DictionaryBlockField[]): Range {
    return new Range(
        sortedUnknownFields[0].keyRange.start,
        sortedUnknownFields[sortedUnknownFields.length - 1].keyRange.end
    );
}
