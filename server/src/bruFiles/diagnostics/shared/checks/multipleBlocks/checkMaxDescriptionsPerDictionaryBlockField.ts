import {
    DictionaryBlock,
    DictionaryBlockDescription,
    isDictionaryBlockDescription,
    isDictionaryBlockField,
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

export function checkMaxDescriptionsPerDictionaryBlockField(
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
    if (
        block.content.every(isDictionaryBlockField) ||
        block.content.filter(isDictionaryBlockDescription).length <= 1
    ) {
        return [];
    }

    const sortedFieldsAndDescriptions = block.content.slice().sort((a, b) => {
        const startRangeForA = isDictionaryBlockField(a)
            ? a.keyRange.start
            : a.range.start;
        const startRangeForB = isDictionaryBlockField(b)
            ? b.keyRange.start
            : b.range.start;

        return startRangeForA.line - startRangeForB.line;
    });

    return sortedFieldsAndDescriptions
        .map((field, index) => {
            if (index == 0) {
                return undefined;
            }

            return isDictionaryBlockDescription(field) &&
                isDictionaryBlockDescription(
                    sortedFieldsAndDescriptions[index - 1],
                )
                ? field
                : undefined;
        })
        .filter((field) => field != undefined);
}

function getDiagnostic(
    filePath: string,
    sortedInvalidDescriptions: {
        block: string;
        description: DictionaryBlockDescription;
    }[],
): DiagnosticWithCode {
    return {
        message: `Only one description is allowed per dictionary block field`,
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
        code: NonBlockSpecificDiagnosticCode.MultipleDescriptionsPerDictionaryBlockField,
    };
}
