import {
    DictionaryBlock,
    DictionaryBlockArrayField,
    DictionaryBlockSimpleField,
    isDictionaryBlockField,
} from "@global_shared";
import { getSortedDictionaryBlockFieldsByPosition } from "../../util/getSortedDictionaryBlockFieldsByPosition";
import { DiagnosticWithCode } from "../../../interfaces";
import { KnownDiagnosticCode } from "../../diagnosticCodes/knownDiagnosticCodeDefinition";
import { DiagnosticSeverity } from "vscode-languageserver";
import { URI } from "vscode-uri";

interface FieldsWithSameKey {
    key: string;
    fields: (DictionaryBlockSimpleField | DictionaryBlockArrayField)[];
}

export function checkNoDuplicateKeysAreDefinedForDictionaryBlock(data: {
    filePath: string;
    block: DictionaryBlock;
    diagnosticCode: KnownDiagnosticCode;
    expectedKeys?: string[];
    showAsWarning?: boolean;
}): DiagnosticWithCode[] | undefined {
    const { block, diagnosticCode, filePath, expectedKeys, showAsWarning } =
        data;
    const fieldsWithDuplicateKeys = getValidDuplicateKeysFromDictionaryBlock(
        block,
        expectedKeys,
    );

    if (fieldsWithDuplicateKeys.length == 0) {
        return undefined;
    }

    return getDiagnostics(
        filePath,
        fieldsWithDuplicateKeys,
        diagnosticCode,
        showAsWarning ? DiagnosticSeverity.Warning : undefined,
    );
}

function getDiagnostics(
    filePath: string,
    fieldsWithDuplicateKeys: FieldsWithSameKey[],
    diagnosticCode: KnownDiagnosticCode,
    severity?: DiagnosticSeverity,
) {
    return fieldsWithDuplicateKeys.map(({ key, fields }) => {
        const sortedFieldsByPosition = getSortedDictionaryBlockFieldsByPosition(
            fields,
        ) as (DictionaryBlockSimpleField | DictionaryBlockArrayField)[];

        return {
            message: `Key '${key}' is defined ${fields.length} times`,
            range: sortedFieldsByPosition[sortedFieldsByPosition.length - 1]
                .keyRange,
            severity,
            code: diagnosticCode,
            relatedInformation: sortedFieldsByPosition
                .slice(0, -1)
                .map(({ keyRange }) => ({
                    message: `Previous definition for key '${key}'`,
                    location: {
                        uri: URI.file(filePath).toString(),
                        range: keyRange,
                    },
                })),
        };
    });
}

function getValidDuplicateKeysFromDictionaryBlock(
    block: DictionaryBlock,
    allValidKeys?: string[],
) {
    const foundValidKeysSorted = block.content
        .filter(isDictionaryBlockField)
        .filter(
            ({ key, disabled }) =>
                (allValidKeys ? allValidKeys.includes(key) : true) && !disabled,
        )
        .sort(({ key: key1 }, { key: key2 }) => (key1 > key2 ? 1 : -1));

    if (foundValidKeysSorted.length == 0) {
        return [];
    }

    const result: FieldsWithSameKey[] = [];

    foundValidKeysSorted.slice(1).forEach((currentField, index) => {
        const previousFieldFromList = foundValidKeysSorted[index];

        if (
            currentField.key == previousFieldFromList.key &&
            !result.some(({ key }) => key == currentField.key)
        ) {
            result.push({
                key: currentField.key,
                fields: [previousFieldFromList, currentField],
            });
        } else if (currentField.key == previousFieldFromList.key) {
            const entryToUpdate = result.find(
                ({ key }) => key == currentField.key,
            ) as FieldsWithSameKey;

            entryToUpdate.fields.push(currentField);
        }
    });

    return result;
}
