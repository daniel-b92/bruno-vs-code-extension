import {
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
    Range as VsCodeRange,
    Uri,
} from "vscode";
import {
    DictionaryBlock,
    DictionaryBlockArrayField,
    DictionaryBlockSimpleField,
    isDictionaryBlockSimpleField,
    Range,
} from "@global_shared";
import { mapToVsCodeRange } from "@shared";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

interface DictionaryFieldsForBlock {
    block: DictionaryBlock;
    fields: (DictionaryBlockSimpleField | DictionaryBlockArrayField)[];
}

export function checkDictionaryBlocksSimpleFieldsStructure(
    documentUri: Uri,
    fieldsToCheck: { block: DictionaryBlock; keys: string[] }[],
): DiagnosticWithCode | undefined {
    const invalidFieldsSortedByPosition =
        getInvalidFieldsSortedByPosition(fieldsToCheck);

    if (invalidFieldsSortedByPosition.length == 0) {
        return undefined;
    }

    return getDiagnostic(documentUri, invalidFieldsSortedByPosition);
}

function getDiagnostic(
    documentUri: Uri,
    sortedFieldsWithIncorrectStructure: DictionaryFieldsForBlock[],
): DiagnosticWithCode {
    return {
        message: `Some dictionary block simple fields do not have the correct structure. A dictionary block with only simple fields matches the following pattern:
<blockName> {
  key1: value1
  key2: value2
}`,
        range: getRange(sortedFieldsWithIncorrectStructure),
        relatedInformation:
            sortedFieldsWithIncorrectStructure.length > 1 ||
            sortedFieldsWithIncorrectStructure[0].fields.length > 1
                ? sortedFieldsWithIncorrectStructure.reduce(
                      (prev, curr) =>
                          prev.concat(
                              curr.fields.map(({ key, keyRange }) => ({
                                  message: `Invalid field '${key}' in block '${curr.block.name}'`,
                                  location: {
                                      uri: documentUri,
                                      range: mapToVsCodeRange(keyRange),
                                  },
                              })),
                          ),
                      [] as DiagnosticRelatedInformation[],
                  )
                : undefined,
        severity: DiagnosticSeverity.Error,
        code: NonBlockSpecificDiagnosticCode.SimpleFieldsInDictionaryBlocksNotStructuredCorrectly,
    };
}

function getInvalidFieldsSortedByPosition(
    fieldsToCheck: { block: DictionaryBlock; keys: string[] }[],
) {
    const invalidFields: DictionaryFieldsForBlock[] = [];

    for (const { block, keys } of fieldsToCheck) {
        const invalidFieldsForBlock = block.content.filter(
            (field) =>
                keys.includes(field.key) &&
                !isDictionaryBlockSimpleField(field),
        );

        if (invalidFieldsForBlock.length > 0) {
            invalidFieldsForBlock.sort(
                ({ keyRange: keyRangeA }, { keyRange: keyRangeB }) =>
                    keyRangeA.start.line - keyRangeB.start.line,
            );

            invalidFields.push({ block, fields: invalidFieldsForBlock });
        }
    }

    return invalidFields.sort(
        ({ block: blockA }, { block: blockB }) =>
            blockA.nameRange.start.line - blockB.nameRange.start.line,
    );
}

function getRange(
    sortedFieldsWithIncorrectStructure: DictionaryFieldsForBlock[],
): VsCodeRange {
    const lastBlockWithInvalidFields =
        sortedFieldsWithIncorrectStructure[
            sortedFieldsWithIncorrectStructure.length - 1
        ];
    const keyRangeEndOfLastField =
        lastBlockWithInvalidFields.fields[
            lastBlockWithInvalidFields.fields.length - 1
        ].keyRange.end;

    return mapToVsCodeRange(
        new Range(
            sortedFieldsWithIncorrectStructure[0].fields[0].keyRange.start,
            keyRangeEndOfLastField,
        ),
    );
}
