import {
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
    Range as VsCodeRange,
    Uri,
} from "vscode";
import {
    Block,
    castBlockToDictionaryBlock,
    DictionaryBlock,
    DictionaryBlockArrayField,
    DictionaryBlockSimpleField,
    isDictionaryBlockSimpleField,
    mapToVsCodeRange,
    Range,
} from "../../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

interface DictionaryFieldsForBlock {
    block: DictionaryBlock;
    fields: (DictionaryBlockSimpleField | DictionaryBlockArrayField)[];
}

export function checkDictionaryBlockSimpleFieldsStructure(
    documentUri: Uri,
    fieldsToCheck: { block: Block; keys: string[] }[],
): DiagnosticWithCode | undefined {
    const fieldsToCheckWithValidBlocks = fieldsToCheck
        .map(({ block, keys }) => ({
            block: castBlockToDictionaryBlock(block),
            keys,
        }))
        .filter(({ block }) => block != undefined) as {
        block: DictionaryBlock;
        keys: string[];
    }[];

    const invalidFieldsSortedByPosition = getInvalidFieldsSortedByPosition(
        fieldsToCheckWithValidBlocks,
    );

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
        message: `Some simple dictionary fields do not have the correct structure. A valid simple dictionary field matches the following pattern:
key: value
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
