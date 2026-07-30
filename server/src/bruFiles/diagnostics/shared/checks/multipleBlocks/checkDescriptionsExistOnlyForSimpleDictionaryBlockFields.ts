import {
    DictionaryBlock,
    DictionaryBlockDescription,
    isDictionaryBlockDescription,
    isDictionaryBlockSimpleField,
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

export function checkDescriptionsExistOnlyForSimpleDictionaryBlockFields(
    filePath: string,
    blocksToCheck: DictionaryBlock[],
): DiagnosticWithCode | undefined {
    const sortedBlocksToCheck = getSortedBlocksByPosition(blocksToCheck);
    const invalidDescriptions = sortedBlocksToCheck.flatMap((block) =>
        getInvalidDescriptionsSortedByPosition(block as DictionaryBlock).map(
            (description) => ({ block: block.name, description }),
        ),
    );

    if (invalidDescriptions.length == 0) {
        return undefined;
    }

    return getDiagnostic(filePath, invalidDescriptions);
}

function getInvalidDescriptionsSortedByPosition(block: DictionaryBlock) {
    if (block.content.filter(isDictionaryBlockDescription).length == 0) {
        return [];
    }

    const simpleFieldsAndDescriptions = block.content.filter(
        (field) =>
            isDictionaryBlockSimpleField(field) ||
            isDictionaryBlockDescription(field),
    );

    const sortedSimpleFieldsAndDescriptions = simpleFieldsAndDescriptions.sort(
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

    return sortedSimpleFieldsAndDescriptions.filter((field, index) => {
        if (!isDictionaryBlockDescription(field)) {
            return false;
        }

        if (index == sortedSimpleFieldsAndDescriptions.length - 1) {
            // Case where last of the relevant entries is a description.
            return true;
        }

        if (sortedSimpleFieldsAndDescriptions.length > index + 1) {
            const descriptionLine = field.range.start.line;
            const nextRelevantEntry =
                sortedSimpleFieldsAndDescriptions[index + 1];

            // Case where entry is a description without the next entry being a simple field..
            return (
                !isDictionaryBlockSimpleField(nextRelevantEntry) ||
                nextRelevantEntry.keyRange.start.line != descriptionLine + 1
            );
        }
    }) as DictionaryBlockDescription[];
}

function getDiagnostic(
    filePath: string,
    sortedInvalidDescriptions: {
        block: string;
        description: DictionaryBlockDescription;
    }[],
): DiagnosticWithCode {
    return {
        message: `A description is only allowed directly before a simple field`,
        range: new Range(
            sortedInvalidDescriptions[0].description.range.start,
            sortedInvalidDescriptions[sortedInvalidDescriptions.length - 1]
                .description.range.end,
        ),
        relatedInformation:
            sortedInvalidDescriptions.length > 1
                ? (sortedInvalidDescriptions.map(({ block, description }) => ({
                      message: `Block '${block}'`,
                      location: {
                          uri: URI.file(filePath).toString(),
                          range: description.range,
                      },
                  })) as DiagnosticRelatedInformation[])
                : undefined,
        severity: DiagnosticSeverity.Error,
        code: NonBlockSpecificDiagnosticCode.DescriptionBeforeNonSimpleFieldInDictionaryBlock,
    };
}
