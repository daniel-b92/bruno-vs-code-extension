import {
    DictionaryBlock,
    DictionaryBlockArrayField,
    DictionaryBlockSimpleField,
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

export function checkNoDuplicateKeysAreDefinedForDictionaryBlock(
    filePath: string,
    block: DictionaryBlock,
    diagnosticCode: KnownDiagnosticCode,
    expectedKeys?: string[],
): DiagnosticWithCode[] | undefined {
    const fieldsWithDuplicateKeys = getValidDuplicateKeysFromDictionaryBlock(
        block,
        expectedKeys,
    );

    if (fieldsWithDuplicateKeys.length == 0) {
        return undefined;
    }

    return getDiagnostics(filePath, fieldsWithDuplicateKeys, diagnosticCode);
}

function getDiagnostics(
    filePath: string,
    fieldsWithDuplicateKeys: FieldsWithSameKey[],
    diagnosticCode: KnownDiagnosticCode,
) {
    return fieldsWithDuplicateKeys.map(({ key, fields }) => {
        const sortedFieldsByPosition =
            getSortedDictionaryBlockFieldsByPosition(fields);

        return {
            message: `Key '${key}' is defined ${fields.length} times`,
            range: sortedFieldsByPosition[sortedFieldsByPosition.length - 1]
                .keyRange,
            severity: DiagnosticSeverity.Error,
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
