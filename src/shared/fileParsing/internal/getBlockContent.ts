import { TextDocumentHelper } from "../../fileSystem/util/textDocumentHelper";
import {
    BlockType,
    parseCodeBlock,
    Position,
    Range,
    ArrayBlockField,
    CodeBlockContent,
    DictionaryBlockArrayField,
    DictionaryBlockSimpleField,
    PlainTextWithinBlock,
    BrunoVariableReference,
    getPatternForVariablesInNonCodeBlock,
    VariableReferenceType,
    BrunoVariableType,
} from "../..";
import { parseJsonBlock } from "./parseJsonBlock";
import { parsePlainTextBlock } from "./parsePlainTextBlock";
import { parseDictionaryBlock } from "./parseDictionaryBlock";
import { parseArrayBlock } from "./parseArrayBlock";
import { SyntaxKind } from "typescript";

export const getBlockContent = (
    document: TextDocumentHelper,
    startingPosition: Position,
    blockType: BlockType,
    searchVariableReferences = false,
):
    | {
          content:
              | string
              | (
                    | DictionaryBlockSimpleField
                    | DictionaryBlockArrayField
                    | PlainTextWithinBlock
                )[]
              | (ArrayBlockField | PlainTextWithinBlock)[]
              | CodeBlockContent;
          contentRange: Range;
          variableRerences?: BrunoVariableReference[];
      }
    | undefined => {
    // the block content is exclusive of the block's opening bracket line
    const firstContentLine = startingPosition.line + 1;

    switch (blockType) {
        case BlockType.Array:
            // Array blocks do not have variable references (currently they are only used within environment files afaik).
            return parseArrayBlock(document, firstContentLine);
        case BlockType.Dictionary:
            const dictionaryBlockWithoutParsedVars = parseDictionaryBlock(
                document,
                firstContentLine,
            );
            return dictionaryBlockWithoutParsedVars && searchVariableReferences
                ? {
                      ...dictionaryBlockWithoutParsedVars,
                      variableRerences:
                          getBrunoVariableReferencesInNonCodeBlock(
                              document,
                              dictionaryBlockWithoutParsedVars.contentRange,
                          ),
                  }
                : dictionaryBlockWithoutParsedVars;
        case BlockType.Code:
            return parseCodeBlock(document, firstContentLine, SyntaxKind.Block);
        case BlockType.Json:
            const jsonBlockWithoutParsedVars = parseJsonBlock(
                document,
                firstContentLine,
            );
            return jsonBlockWithoutParsedVars
                ? {
                      ...jsonBlockWithoutParsedVars,
                      variableRerences:
                          getBrunoVariableReferencesInNonCodeBlock(
                              document,
                              jsonBlockWithoutParsedVars.contentRange,
                          ),
                  }
                : jsonBlockWithoutParsedVars;
        case BlockType.PlainText:
            const plainTextBlockWithoutParsedVars = parsePlainTextBlock(
                document,
                firstContentLine,
            );
            return plainTextBlockWithoutParsedVars
                ? {
                      ...plainTextBlockWithoutParsedVars,
                      variableRerences:
                          getBrunoVariableReferencesInNonCodeBlock(
                              document,
                              plainTextBlockWithoutParsedVars.contentRange,
                          ),
                  }
                : plainTextBlockWithoutParsedVars;

        default:
            throw new Error(
                `Cannot parse block with unknown type '${blockType}'. Known block types are ${JSON.stringify(
                    Object.entries(BlockType),
                    null,
                    2,
                )}`,
            );
    }
};

function getBrunoVariableReferencesInNonCodeBlock(
    fullDocumentHelper: TextDocumentHelper,
    contentRange: Range,
): BrunoVariableReference[] {
    const result: BrunoVariableReference[] = [];
    let remainingContent = fullDocumentHelper.getText(contentRange);

    do {
        const matches =
            getPatternForVariablesInNonCodeBlock().exec(remainingContent);

        if (matches == null || matches.length == 0) {
            return result;
        }
        const matchingText = matches[0];
        const variableStartOffsetWithinMatch = 2;
        const variableName = matchingText.substring(
            matchingText.indexOf("{{") + variableStartOffsetWithinMatch,
            matchingText.indexOf("}}"),
        );
        const variableStartPositionInFullDocument =
            fullDocumentHelper.getPositionForOffset(
                contentRange.start,
                matches.index + variableStartOffsetWithinMatch,
            );

        if (!variableStartPositionInFullDocument) {
            return result;
        }

        result.push({
            variableName,
            variableNameRange: new Range(
                variableStartPositionInFullDocument,
                new Position(
                    variableStartPositionInFullDocument.line,
                    variableStartPositionInFullDocument.character +
                        variableName.length,
                ),
            ),
            referenceType: VariableReferenceType.Read,
            variableType: BrunoVariableType.Unknown,
        });

        remainingContent =
            remainingContent.length > matches.index + matchingText.length
                ? remainingContent.substring(
                      matches.index + matchingText.length,
                  )
                : "";
    } while (remainingContent.length > 0);

    return result;
}
