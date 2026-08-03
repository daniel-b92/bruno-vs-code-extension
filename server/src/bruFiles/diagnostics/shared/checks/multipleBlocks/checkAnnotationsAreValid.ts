import {
    DictionaryBlock,
    DictionaryBlockArrayField,
    DictionaryBlockDescription,
    DictionaryBlockSimpleField,
    DictionaryBlockTypeAnnotation,
    isDictionaryBlockDescription,
    isDictionaryBlockField,
    isDictionaryBlockSimpleField,
    isDictionaryBlockTypeAnnotation,
} from "@global_shared";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { DiagnosticSeverity } from "vscode-languageserver";

type InvalidityReason =
    | NonBlockSpecificDiagnosticCode.DuplicateAnnotationOfSameSortInDictionaryBlock
    | NonBlockSpecificDiagnosticCode.AnnotationBeforeNonSimpleFieldInDictionaryBlock;

const fieldTypes = {
    Simple: "Simple",
    Description: "Description",
    TypeAnnotation: "Type annotation",
    Other: "Other",
} as const;

export function checkAnnotationsAreValid(
    blocksToCheck: DictionaryBlock[],
): DiagnosticWithCode[] {
    const sortedBlocksToCheck = getSortedBlocksByPosition(
        blocksToCheck,
    ) as DictionaryBlock[];
    const invalidAnnotations = sortedBlocksToCheck.flatMap((block) =>
        getInvalidAnnotationsSortedByPosition(block),
    );

    if (invalidAnnotations.length == 0) {
        return [];
    }

    return getDiagnostics(invalidAnnotations);
}

function getDiagnostics(
    sortedInvalidAnnotations: {
        field: DictionaryBlockDescription | DictionaryBlockTypeAnnotation;
        reason: InvalidityReason;
    }[],
): DiagnosticWithCode[] {
    return sortedInvalidAnnotations.map(({ field: { range }, reason }) => ({
        message:
            reason ==
            NonBlockSpecificDiagnosticCode.AnnotationBeforeNonSimpleFieldInDictionaryBlock
                ? "An annotation is only allowed directly before a simple field"
                : "An annotation is only allowed once per field",
        range,
        severity: DiagnosticSeverity.Error,
        code: reason,
    }));
}

function getInvalidAnnotationsSortedByPosition(block: DictionaryBlock): {
    field: DictionaryBlockDescription | DictionaryBlockTypeAnnotation;
    reason: InvalidityReason;
}[] {
    if (block.content.filter(isAnnotationField).length == 0) {
        return [];
    }

    const sortedFields = block.content
        .sort((a, b) => {
            const startRangeForA = isDictionaryBlockField(a)
                ? a.keyRange.start
                : a.range.start;
            const startRangeForB = isDictionaryBlockField(b)
                ? b.keyRange.start
                : b.range.start;

            return startRangeForA.line - startRangeForB.line;
        })
        .map((field) => ({
            field,
            type: isDictionaryBlockSimpleField(field)
                ? fieldTypes.Simple
                : isDictionaryBlockDescription(field)
                  ? fieldTypes.Description
                  : isDictionaryBlockTypeAnnotation(field)
                    ? fieldTypes.TypeAnnotation
                    : fieldTypes.Other,
        }));

    const nonAnnotationFieldIndexes = sortedFields
        .map(({ field }, index) =>
            isAnnotationField(field) || field.disabled ? undefined : index,
        )
        .filter((v) => v != undefined);

    if (nonAnnotationFieldIndexes.length == 0) {
        return sortedFields.map(({ field }) => ({
            field: field as
                | DictionaryBlockDescription
                | DictionaryBlockTypeAnnotation,
            reason: NonBlockSpecificDiagnosticCode.AnnotationBeforeNonSimpleFieldInDictionaryBlock,
        }));
    }

    const result: {
        field: DictionaryBlockDescription | DictionaryBlockTypeAnnotation;
        reason: InvalidityReason;
    }[] = [];

    result.push(
        ...getInvalidOnesFromConsecutiveAnnotationFields(
            sortedFields.slice(0, nonAnnotationFieldIndexes[0]) as {
                field:
                    | DictionaryBlockDescription
                    | DictionaryBlockTypeAnnotation;
                type: (typeof fieldTypes)[keyof typeof fieldTypes];
            }[],
            sortedFields[nonAnnotationFieldIndexes[0]].field as
                | DictionaryBlockSimpleField
                | DictionaryBlockArrayField,
        ),
    );

    for (let i = 0; i < nonAnnotationFieldIndexes.length; i++) {
        const followingNonAnnotationFieldIndex =
            i + 1 < nonAnnotationFieldIndexes.length
                ? nonAnnotationFieldIndexes[i + 1]
                : undefined;

        const consecutiveAnnotationFields = sortedFields.slice(
            nonAnnotationFieldIndexes[i] + 1,
            followingNonAnnotationFieldIndex,
        ) as {
            field: DictionaryBlockDescription | DictionaryBlockTypeAnnotation;
            type: (typeof fieldTypes)[keyof typeof fieldTypes];
        }[];

        result.push(
            ...getInvalidOnesFromConsecutiveAnnotationFields(
                consecutiveAnnotationFields,
                followingNonAnnotationFieldIndex == undefined
                    ? undefined
                    : (sortedFields[followingNonAnnotationFieldIndex].field as
                          | DictionaryBlockSimpleField
                          | DictionaryBlockArrayField),
            ),
        );
    }

    return result;
}

function getInvalidOnesFromConsecutiveAnnotationFields(
    consecutiveAnnotationFields: {
        field: DictionaryBlockDescription | DictionaryBlockTypeAnnotation;
        type: (typeof fieldTypes)[keyof typeof fieldTypes];
    }[],
    followingNonAnnotationField?:
        | DictionaryBlockSimpleField
        | DictionaryBlockArrayField,
): {
    field: DictionaryBlockDescription | DictionaryBlockTypeAnnotation;
    reason: InvalidityReason;
}[] {
    if (
        !followingNonAnnotationField ||
        !isDictionaryBlockSimpleField(followingNonAnnotationField)
    ) {
        return consecutiveAnnotationFields.map(({ field }) => ({
            field: field as
                | DictionaryBlockDescription
                | DictionaryBlockTypeAnnotation,
            reason: NonBlockSpecificDiagnosticCode.AnnotationBeforeNonSimpleFieldInDictionaryBlock as InvalidityReason,
        }));
    }

    const annotationFieldsGroupedBySort = consecutiveAnnotationFields.reduce(
        (prev, { field, type }) => {
            const matchingIndex = prev.findIndex(({ type: t }) => t == type);

            return matchingIndex >= 0
                ? prev.map((val, index) =>
                      index != matchingIndex
                          ? val
                          : {
                                ...val,
                                count: val.count + 1,
                                fields: val.fields.concat(field),
                            },
                  )
                : prev.concat({ fields: [field], type, count: 1 });
        },
        [] as {
            fields: (
                | DictionaryBlockDescription
                | DictionaryBlockTypeAnnotation
            )[];
            type: (typeof fieldTypes)[keyof typeof fieldTypes];
            count: number;
        }[],
    );

    const duplicateAnnotationFields = annotationFieldsGroupedBySort.filter(
        ({ count }) => count > 1,
    );

    if (duplicateAnnotationFields.length > 0) {
        return duplicateAnnotationFields.flatMap(({ fields }) =>
            fields.map((field) => ({
                field,
                reason: NonBlockSpecificDiagnosticCode.DuplicateAnnotationOfSameSortInDictionaryBlock as InvalidityReason,
            })),
        );
    }

    return [];
}

function isAnnotationField(
    field:
        | DictionaryBlockSimpleField
        | DictionaryBlockArrayField
        | DictionaryBlockDescription
        | DictionaryBlockTypeAnnotation,
) {
    return (
        isDictionaryBlockDescription(field) ||
        isDictionaryBlockTypeAnnotation(field)
    );
}
