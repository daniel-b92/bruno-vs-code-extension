import {
    DictionaryBlock,
    isDictionaryBlockSimpleField,
    Range,
    isDictionaryBlockDescription,
    MultilineStringAdditionalData,
    TextDocumentHelper,
} from "@global_shared";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkDictionaryBlocksMultilineStringsAreValid(
    docHelper: TextDocumentHelper,
    blocks: DictionaryBlock[],
): (DiagnosticWithCode | undefined)[] {
    const sortedBlocks = getSortedBlocksByPosition(blocks) as DictionaryBlock[];

    const toCheck = sortedBlocks
        .flatMap(({ content }) =>
            content.map((field) =>
                isDictionaryBlockDescription(field) &&
                field.multilineValueSpecificData
                    ? {
                          stringRange: field.range,
                          data: field.multilineValueSpecificData,
                          type: "description" as const,
                      }
                    : isDictionaryBlockSimpleField(field) &&
                        field.multilineValueSpecificData
                      ? {
                            stringRange: field.valueRange,
                            data: field.multilineValueSpecificData,
                            type: "value" as const,
                        }
                      : undefined,
            ),
        )
        .filter((val) => val != undefined);

    return toCheck.flatMap(({ data, stringRange, type }) => {
        const commonCheckResults = runCommonChecks(stringRange, data);

        if (isError(data)) {
            return commonCheckResults;
        }

        const { tailingTextAfterClosingQuotes } = data;

        return type == "description"
            ? runDescriptionSpecificChecks(
                  docHelper,
                  stringRange,
                  tailingTextAfterClosingQuotes,
              )
            : runValueSpecificChecks(docHelper, tailingTextAfterClosingQuotes);
    });
}

function runCommonChecks(
    fullStringRange: Range,
    data: MultilineStringAdditionalData,
): DiagnosticWithCode[] {
    if (isError(data)) {
        return [
            {
                code: NonBlockSpecificDiagnosticCode.InvalidSMultilineStringInDictionaryBlock,
                message: "Missing closing quotes ''' for multiline string.",
                range: fullStringRange,
            },
        ];
    }

    const {
        invalidIncludedTextInOpeningLine,
        invalidIncludedTextInClosingLine,
    } = data;

    return [invalidIncludedTextInOpeningLine, invalidIncludedTextInClosingLine]
        .filter((range) => range != undefined)
        .map((range) => ({
            code: NonBlockSpecificDiagnosticCode.InvalidSMultilineStringInDictionaryBlock,
            message:
                "In a multiline string, text is not allowed in the line with the opening or closing quotes.",
            range,
        }));
}

function runDescriptionSpecificChecks(
    docHelper: TextDocumentHelper,
    fullDescriptionRange: Range,
    tailingTextAfterClosingQuotes?: Range,
): DiagnosticWithCode | undefined {
    const textAfterClosingQuotes = tailingTextAfterClosingQuotes
        ? docHelper.getText(tailingTextAfterClosingQuotes)
        : "";
    const allowedTextPattern = /^\s*\)\s*$/;

    return allowedTextPattern.test(textAfterClosingQuotes)
        ? undefined
        : {
              code: NonBlockSpecificDiagnosticCode.InvalidStructureForMultilineDescriptionInDictionaryBlock,
              message:
                  "Invalid text for multiline description after closing quotes. Allowed is only ')' with leading or trailing whitespace characters.",
              range: tailingTextAfterClosingQuotes ?? fullDescriptionRange,
          };
}

function runValueSpecificChecks(
    docHelper: TextDocumentHelper,
    tailingTextAfterClosingQuotes?: Range,
): DiagnosticWithCode | undefined {
    if (!tailingTextAfterClosingQuotes) {
        return undefined;
    }
    const actualContent = docHelper.getText(tailingTextAfterClosingQuotes);
    const allowedTextPattern = /^\s*$/;

    return allowedTextPattern.test(actualContent)
        ? undefined
        : {
              code: NonBlockSpecificDiagnosticCode.InvalidStructureForMultilineValueInDictionaryBlock,
              message:
                  "No text is allowed after closing quotes for multiline value.",
              range: tailingTextAfterClosingQuotes,
          };
}

function isError(
    data: MultilineStringAdditionalData,
): data is { err: "missingClosingQuotes" } {
    return "err" in data;
}
