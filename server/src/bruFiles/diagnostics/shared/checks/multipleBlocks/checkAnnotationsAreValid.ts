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

type AnnotationField =
    DictionaryBlockDescription | DictionaryBlockTypeAnnotation;
type NonAnnotationField =
    DictionaryBlockSimpleField | DictionaryBlockArrayField;

interface InvalidAnnotation {
    field: AnnotationField;
    reason: InvalidityReason;
}

export function checkAnnotationsAreValid(
    blocksToCheck: DictionaryBlock[],
): DiagnosticWithCode[] {
    const sortedBlocksToCheck = getSortedBlocksByPosition(
        blocksToCheck,
    ) as DictionaryBlock[];

    return sortedBlocksToCheck
        .flatMap(getInvalidAnnotationsSortedByPosition)
        .map(({ field: { range }, reason }) => ({
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

function getInvalidAnnotationsSortedByPosition(
    block: DictionaryBlock,
): InvalidAnnotation[] {
    const sortedFields = block.content.slice().sort((a, b) => {
        const startRangeForA = isDictionaryBlockField(a)
            ? a.keyRange.start
            : a.range.start;
        const startRangeForB = isDictionaryBlockField(b)
            ? b.keyRange.start
            : b.range.start;

        return startRangeForA.line - startRangeForB.line;
    });

    const result: InvalidAnnotation[] = [];
    let consecutiveAnnotations: AnnotationField[] = [];

    for (const field of sortedFields) {
        if (isAnnotationField(field)) {
            consecutiveAnnotations.push(field);
        } else {
            result.push(
                ...getInvalidOnesFromConsecutiveAnnotationFields(
                    consecutiveAnnotations,
                    field,
                ),
            );
            consecutiveAnnotations = [];
        }
    }

    // Annotations at the end of the block are not followed by any field.
    result.push(
        ...getInvalidOnesFromConsecutiveAnnotationFields(
            consecutiveAnnotations,
            undefined,
        ),
    );

    return result;
}

function getInvalidOnesFromConsecutiveAnnotationFields(
    consecutiveAnnotationFields: AnnotationField[],
    followingNonAnnotationField: NonAnnotationField | undefined,
): InvalidAnnotation[] {
    if (consecutiveAnnotationFields.length == 0) {
        return [];
    }

    if (
        !followingNonAnnotationField ||
        !isDictionaryBlockSimpleField(followingNonAnnotationField)
    ) {
        return consecutiveAnnotationFields.map((field) => ({
            field,
            reason: NonBlockSpecificDiagnosticCode.AnnotationBeforeNonSimpleFieldInDictionaryBlock,
        }));
    }

    const descriptions = consecutiveAnnotationFields.filter(
        isDictionaryBlockDescription,
    );
    const typeAnnotations = consecutiveAnnotationFields.filter(
        isDictionaryBlockTypeAnnotation,
    );

    return [descriptions, typeAnnotations]
        .filter((sameSortAnnotations) => sameSortAnnotations.length > 1)
        .flatMap((sameSortAnnotations) =>
            sameSortAnnotations.map((field) => ({
                field,
                reason: NonBlockSpecificDiagnosticCode.DuplicateAnnotationOfSameSortInDictionaryBlock,
            })),
        );
}

function isAnnotationField(
    field: NonAnnotationField | AnnotationField,
): field is AnnotationField {
    return (
        isDictionaryBlockDescription(field) ||
        isDictionaryBlockTypeAnnotation(field)
    );
}
