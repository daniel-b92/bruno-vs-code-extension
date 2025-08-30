import { DiagnosticSeverity, Range } from "vscode";
import {
    DictionaryBlockSimpleField,
    DictionaryBlock,
    mapToVsCodePosition,
} from "../../../../../../../shared";
import { getSortedDictionaryBlockFieldsByPosition } from "../../util/getSortedDictionaryBlockFieldsByPosition";
import {
    FieldsWithSameKey,
    getValidDuplicateKeysFromDictionaryBlock,
} from "../../util/getValidDuplicateKeysFromDictionaryBlock";
import { DiagnosticWithCode } from "../../../definitions";
import { KnownDiagnosticCode } from "../../diagnosticCodes/knownDiagnosticCodeDefinition";

export function checkNoDuplicateKeysAreDefinedForDictionaryBlock(
    block: DictionaryBlock,
    expectedKeys: string[],
    diagnosticCode: KnownDiagnosticCode
): DiagnosticWithCode | undefined {
    const fieldsWithDuplicateKeys = getValidDuplicateKeysFromDictionaryBlock(
        block,
        expectedKeys
    );

    if (fieldsWithDuplicateKeys.length > 0) {
        return getDiagnostic(fieldsWithDuplicateKeys, diagnosticCode);
    } else {
        return undefined;
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

function getRange(sortedDuplicateFields: DictionaryBlockSimpleField[]): Range {
    return new Range(
        mapToVsCodePosition(sortedDuplicateFields[0].keyRange.start),
        mapToVsCodePosition(
            sortedDuplicateFields[sortedDuplicateFields.length - 1].keyRange.end
        )
    );
}
