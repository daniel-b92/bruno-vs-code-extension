import {
    DictionaryBlock,
    DictionaryBlockDescription,
    DictionaryBlockTypeAnnotation,
    isDictionaryBlockDescription,
    isDictionaryBlockSimpleField,
    isDictionaryBlockTypeAnnotation,
    Range,
} from "@global_shared";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { URI } from "vscode-uri";
import {
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
} from "vscode-languageserver";

export function checkAnnotationsExistOnlyForSimpleDictionaryBlockFields(
    filePath: string,
    blocksToCheck: DictionaryBlock[],
): DiagnosticWithCode | undefined {
    const sortedBlocksToCheck = getSortedBlocksByPosition(blocksToCheck);
    const invalidAnnotations = sortedBlocksToCheck.flatMap((block) =>
        getInvalidAnnotationsSortedByPosition(block as DictionaryBlock).map(
            (field) => ({ block: block.name, field }),
        ),
    );

    if (invalidAnnotations.length == 0) {
        return undefined;
    }

    return getDiagnostic(filePath, invalidAnnotations);
}

function getInvalidAnnotationsSortedByPosition(block: DictionaryBlock) {
    if (
        block.content.filter(
            (field) =>
                isDictionaryBlockDescription(field) ||
                isDictionaryBlockTypeAnnotation(field),
        ).length == 0
    ) {
        return [];
    }

    const simpleFieldsAndAnnotations = block.content.filter(
        (field) =>
            isDictionaryBlockSimpleField(field) ||
            isDictionaryBlockDescription(field) ||
            isDictionaryBlockTypeAnnotation(field),
    );

    const sortedSimpleFieldsAndAnnotations = simpleFieldsAndAnnotations.sort(
        (a, b) => {
            const startRangeForA = isDictionaryBlockSimpleField(a)
                ? a.keyRange.start
                : a.range.start;
            const startRangeForB = isDictionaryBlockSimpleField(b)
                ? b.keyRange.start
                : b.range.start;

            return startRangeForA.line - startRangeForB.line;
        },
    );

    return sortedSimpleFieldsAndAnnotations.filter((field, index) => {
        if (
            !isDictionaryBlockDescription(field) &&
            !isDictionaryBlockTypeAnnotation(field)
        ) {
            return false;
        }

        if (index == sortedSimpleFieldsAndAnnotations.length - 1) {
            // Case where last of the relevant entries is an annotation.
            return true;
        }

        if (sortedSimpleFieldsAndAnnotations.length > index + 1) {
            const annotationLine = field.range.start.line;
            const nextRelevantEntry =
                sortedSimpleFieldsAndAnnotations[index + 1];

            if (isDictionaryBlockSimpleField(nextRelevantEntry)) {
                return false;
            }

            const isNextLineSameKindOfAnnotation =
                (isDictionaryBlockDescription(field) &&
                    isDictionaryBlockDescription(nextRelevantEntry)) ||
                (isDictionaryBlockTypeAnnotation(field) &&
                    isDictionaryBlockTypeAnnotation(nextRelevantEntry));
            // Can either be invlid, if next line is same kind of annotation or if next line is neither an annotation nor a simple field.
            return (
                isNextLineSameKindOfAnnotation ||
                nextRelevantEntry.range.start.line != annotationLine + 1
            );
        }
    }) as (DictionaryBlockDescription | DictionaryBlockTypeAnnotation)[];
}

function getDiagnostic(
    filePath: string,
    sortedInvalidAnnotations: {
        block: string;
        field: DictionaryBlockDescription | DictionaryBlockTypeAnnotation;
    }[],
): DiagnosticWithCode {
    return {
        message: `An annotation is only allowed directly before a simple field and only once per field`,
        range: new Range(
            sortedInvalidAnnotations[0].field.range.start,
            sortedInvalidAnnotations[sortedInvalidAnnotations.length - 1].field
                .range.end,
        ),
        relatedInformation:
            sortedInvalidAnnotations.length > 1
                ? (sortedInvalidAnnotations.map(
                      ({ block, field: description }) => ({
                          message: `Block '${block}'`,
                          location: {
                              uri: URI.file(filePath).toString(),
                              range: description.range,
                          },
                      }),
                  ) as DiagnosticRelatedInformation[])
                : undefined,
        severity: DiagnosticSeverity.Error,
        code: NonBlockSpecificDiagnosticCode.AnnotationBeforeNonSimpleFieldInDictionaryBlock,
    };
}
