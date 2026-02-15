import {
    DictionaryBlock,
    DictionaryBlockArrayField,
    DictionaryBlockSimpleField,
    isDictionaryBlockSimpleField,
    Range,
} from "@global_shared";
import { DiagnosticWithCode } from "../../../interfaces";
import { KnownDiagnosticCode } from "../../diagnosticCodes/knownDiagnosticCodeDefinition";
import { getSortedDictionaryBlockFieldsByPosition } from "../../util/getSortedDictionaryBlockFieldsByPosition";
import { DiagnosticSeverity } from "vscode-languageserver";

export function checkNoMandatoryValuesAreMissingForDictionaryBlock(
    block: DictionaryBlock,
    keysWhereValuesAreMandatory: string[],
    diagnosticCode: KnownDiagnosticCode,
): DiagnosticWithCode | undefined {
    const fieldsWithMissingValues =
        getSimpleFieldsWithEmptyValuesForDictionaryBlock(block).filter(
            ({ key }) => keysWhereValuesAreMandatory.includes(key),
        );

    if (fieldsWithMissingValues.length > 0) {
        return getDiagnostic(fieldsWithMissingValues, diagnosticCode);
    } else {
        return undefined;
    }
}

function getDiagnostic(
    fieldsWithMissingValues: DictionaryBlockSimpleField[],
    diagnosticCode: KnownDiagnosticCode,
) {
    return {
        message:
            fieldsWithMissingValues.length == 1
                ? `Value for key '${fieldsWithMissingValues[0].key}' is missing.`
                : `Mandatory values for keys '${JSON.stringify(
                      fieldsWithMissingValues.map(({ key }) => key),
                      null,
                      2,
                  )}' are missing.`,
        range: getRange(
            getSortedDictionaryBlockFieldsByPosition(fieldsWithMissingValues),
        ),
        severity: DiagnosticSeverity.Error,
        code: diagnosticCode,
    };
}

function getRange(
    sortedFields: (DictionaryBlockSimpleField | DictionaryBlockArrayField)[],
): Range {
    return new Range(
        sortedFields[0].keyRange.start,
        sortedFields[sortedFields.length - 1].keyRange.end,
    );
}

function getSimpleFieldsWithEmptyValuesForDictionaryBlock(
    block: DictionaryBlock,
) {
    return block.content.filter(
        (field) =>
            isDictionaryBlockSimpleField(field) && /^\s*$/.test(field.value),
    ) as DictionaryBlockSimpleField[];
}
