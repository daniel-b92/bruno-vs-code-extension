import { DiagnosticSeverity, Range } from "vscode";
import { DictionaryBlockField, DictionaryBlock } from "../../../../../shared";
import { getSortedDictionaryBlockFieldsByPosition } from "../../util/getSortedDictionaryBlockFieldsByPosition";
import {
    FieldsWithSameKey,
    getValidDuplicateKeysFromDictionaryBlock,
} from "../../util/getValidDuplicateKeysFromDictionaryBlock";
import { DiagnosticWithCode } from "../../definitions";
import { KnownDiagnosticCode } from "../../diagnosticCodes/knownDiagnosticCodeEnum";

export function checkNoDuplicateKeysAreDefinedForDictionaryBlock(
    block: DictionaryBlock,
    expectedKeys: string[],
    diagnosticCode: KnownDiagnosticCode
): DiagnosticWithCode | KnownDiagnosticCode {
    const fieldsWithDuplicateKeys = getValidDuplicateKeysFromDictionaryBlock(
        block,
        expectedKeys
    );

    if (fieldsWithDuplicateKeys.length > 0) {
        return getDiagnostic(fieldsWithDuplicateKeys, diagnosticCode);
    } else {
        return diagnosticCode;
    }
}

function getDiagnostic(
    fieldsWithDuplicateKeys: FieldsWithSameKey[],
    diagnosticCode: KnownDiagnosticCode
) {
    const sortedFieldsByPosition = getSortedDictionaryBlockFieldsByPosition(
        fieldsWithDuplicateKeys.map(({ fields }) => fields).flat()
    );

    return {
        message: `Some keys are defined multiple times: '${fieldsWithDuplicateKeys
            .map(({ key }) => key)
            .join("', '")}'.`,
        range: getRange(sortedFieldsByPosition),
        severity: DiagnosticSeverity.Error,
        code: diagnosticCode,
    };
}

function getRange(sortedDuplicateFields: DictionaryBlockField[]): Range {
    return new Range(
        sortedDuplicateFields[0].keyRange.start,
        sortedDuplicateFields[sortedDuplicateFields.length - 1].keyRange.end
    );
}
