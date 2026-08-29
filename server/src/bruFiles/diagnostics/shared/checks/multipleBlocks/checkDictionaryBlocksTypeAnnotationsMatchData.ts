import {
    DictionaryBlock,
    isDictionaryBlockTypeAnnotation,
    isDictionaryBlockSimpleField,
    DictionaryBlockTypeAnnotationValue,
    DictionaryBlockTypeAnnotation,
    Range,
    isDictionaryBlockArrayField,
} from "@global_shared";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { URI } from "vscode-uri";
import { DiagnosticSeverity } from "vscode-languageserver";
import { getSortedDictionaryBlockFieldsByPosition } from "../../util/getSortedDictionaryBlockFieldsByPosition";

export function checkDictionaryBlocksTypeAnnotationsMatchData(
    filePath: string,
    blocks: DictionaryBlock[],
): DiagnosticWithCode[] {
    const sortedBlocks = getSortedBlocksByPosition(blocks) as DictionaryBlock[];

    const typesWithData = sortedBlocks.flatMap((block) =>
        getTypeAnnotationsWithCorrespondingFields(block),
    );
    const invalidTypesWithData = typesWithData.filter(
        ({ data: { value: dataValue }, type: { value: typeValue } }) =>
            !isValid(dataValue, typeValue),
    );

    return invalidTypesWithData.length > 0
        ? getDiagnostic(filePath, invalidTypesWithData)
        : [];
}

function getDiagnostic(
    filePath: string,
    invalidTypesWithData: {
        type: DictionaryBlockTypeAnnotation;
        data: {
            value: string;
            valueRange: Range;
        };
    }[],
): DiagnosticWithCode[] {
    return invalidTypesWithData.map(({ data, type }) => ({
        message: `Is not a valid ${type.value}`,
        range: data.valueRange,
        relatedInformation: [
            {
                message: `Type annotation`,
                location: {
                    uri: URI.file(filePath).toString(),
                    range: type.range,
                },
            },
        ],
        severity: DiagnosticSeverity.Warning,
        code: NonBlockSpecificDiagnosticCode.TypeAnnotationNotMatchingValueInDictionaryBlock,
    }));
}

function getTypeAnnotationsWithCorrespondingFields({
    content,
}: DictionaryBlock) {
    const sortedFields = getSortedDictionaryBlockFieldsByPosition(content);

    return sortedFields
        .map((field, index) => {
            if (index >= sortedFields.length - 1) {
                return undefined;
            }
            const allFollowingFields = sortedFields.slice(index + 1);
            const followingFieldWithValue = allFollowingFields.find(
                (field) =>
                    isDictionaryBlockSimpleField(field) ||
                    isDictionaryBlockArrayField(field),
            );

            return isDictionaryBlockTypeAnnotation(field) &&
                followingFieldWithValue &&
                isDictionaryBlockSimpleField(followingFieldWithValue) &&
                !followingFieldWithValue.disabled
                ? { type: field, data: followingFieldWithValue }
                : undefined;
        })
        .filter((val) => val != undefined);
}

function isValid(data: string, type: DictionaryBlockTypeAnnotationValue) {
    const isBoolean = ["true", "false"].includes(data);
    const isNumber = !isNaN(Number(data));

    switch (type) {
        case DictionaryBlockTypeAnnotationValue.Boolean:
            return isBoolean;
        case DictionaryBlockTypeAnnotationValue.Number:
            return isNumber;
        case DictionaryBlockTypeAnnotationValue.Object:
            try {
                JSON.parse(data);
                // The Bruno desktop app seems to not support the object type for variables that also could be stored as a boolean or a number.
                return !isBoolean && !isNumber;
            } catch {
                return false;
            }
    }
}
