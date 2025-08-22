import { DiagnosticSeverity, Range } from "vscode";
import {
    DictionaryBlock,
    DictionaryBlockField,
    mapToVsCodePosition,
} from "../../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { KnownDiagnosticCode } from "../../diagnosticCodes/knownDiagnosticCodeDefinition";
import { getFieldsWithEmptyValuesForDictionaryBlock } from "../../util/getFieldsWithEmptyValuesForDictionaryBlock";
import { getSortedDictionaryBlockFieldsByPosition } from "../../util/getSortedDictionaryBlockFieldsByPosition";

export function checkNoMandatoryValuesAreMissingForDictionaryBlock(
    block: DictionaryBlock,
    keysWhereValuesAreMandatory: string[],
    diagnosticCode: KnownDiagnosticCode
): DiagnosticWithCode | undefined {
    const fieldsWithMissingValues = getFieldsWithEmptyValuesForDictionaryBlock(
        block
    ).filter(({ key }) => keysWhereValuesAreMandatory.includes(key));

    if (fieldsWithMissingValues.length > 0) {
        return getDiagnostic(fieldsWithMissingValues, diagnosticCode);
    } else {
        return undefined;
    }
}

function getDiagnostic(
    fieldsWithMissingValues: DictionaryBlockField[],
    diagnosticCode: KnownDiagnosticCode
) {
    return {
        message:
            fieldsWithMissingValues.length == 1
                ? `Value for key '${fieldsWithMissingValues[0].key}' is missing.`
                : `Mandatory values for keys '${JSON.stringify(
                      fieldsWithMissingValues.map(({ key }) => key),
                      null,
                      2
                  )}' are missing.`,
        range: getRange(
            getSortedDictionaryBlockFieldsByPosition(fieldsWithMissingValues)
        ),
        severity: DiagnosticSeverity.Error,
        code: diagnosticCode,
    };
}

function getRange(sortedFields: DictionaryBlockField[]): Range {
    return new Range(
        mapToVsCodePosition(sortedFields[0].keyRange.start),
        mapToVsCodePosition(sortedFields[sortedFields.length - 1].keyRange.end)
    );
}
