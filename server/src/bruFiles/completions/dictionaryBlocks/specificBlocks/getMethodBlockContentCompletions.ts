import {
    MethodBlockKey,
    MethodBlockBodies,
    MethodBlockAuthValues,
    Block,
    getMandatoryKeysForMethodBlock,
    Range,
    Position,
    TextDocumentHelper,
    isAuthBlock,
    AuthBlockName,
    OAuth2AuthBlocksCommonKeys,
    getMandatoryKeysForNonOAuth2Block,
    AuthBlockNamesExcludingOAuth2,
    LineBreakType,
    BlockBracket,
    getExpectedAuthBlockForType,
    isBodyBlock,
    getAuthTypesForNoDefinedAuthBlock,
    getBodyBlockTypeForNoDefinedBodyBlock,
} from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../../../shared";
import { getLinePatternForDictionaryField } from "../generic/getLinePatternForDictionaryField";

import { getCompletionsForKeys } from "../generic/getCompletionsForKeys";
import { getTextEditForDictionaryBlockSimpleValue } from "../generic/getTextEditForDictionaryBlockSimpleValue";
import { CompletionItem, TextEdit } from "vscode-languageserver";

export function getMethodBlockContentCompletions(
    request: LanguageFeatureBaseRequest,
    allBlocks: Block[],
    block: Block,
) {
    const completionsForKeys = getCompletionsForKeys(request, block, {
        mandatory: getMandatoryKeysForMethodBlock(block.name),
    });

    if (completionsForKeys) {
        return completionsForKeys;
    }

    return getValueCompletions(
        block,
        allBlocks,
        request,
        request.documentHelper.getMostUsedLineBreak() ?? LineBreakType.Lf,
    );
}

function getValueCompletions(
    methodBlock: Block,
    allBlocks: Block[],
    baseRequest: LanguageFeatureBaseRequest,
    lineBreak: LineBreakType,
): CompletionItem[] | undefined {
    const {
        documentHelper,
        position: { line },
    } = baseRequest;
    const currentText = documentHelper.getLineByIndex(line);

    const isInAuthField = getLinePatternForDictionaryField(
        MethodBlockKey.Auth,
    ).test(currentText);
    const isInBodyField = getLinePatternForDictionaryField(
        MethodBlockKey.Body,
    ).test(currentText);

    if (!isInAuthField && !isInBodyField) {
        return undefined;
    }

    if (isInAuthField) {
        return getCompletionsForAuthFieldValue(
            baseRequest,
            allBlocks,
            methodBlock,
            { currentLineContent: currentText, lineBreak },
        );
    }

    return getCompletionsForBodyFieldValue(
        baseRequest,
        allBlocks,
        methodBlock,
        { currentLineContent: currentText, lineBreak },
    );
}

function getCompletionsForAuthFieldValue(
    { documentHelper, position: { line } }: LanguageFeatureBaseRequest,
    allBlocks: Block[],
    methodBlock: Block,
    content: { currentLineContent: string; lineBreak: LineBreakType },
) {
    const { currentLineContent, lineBreak } = content;
    const existingAuthBlocks = allBlocks.filter(({ name }) =>
        isAuthBlock(name),
    );
    const authTypesWithoutAnAuthBlock = getAuthTypesForNoDefinedAuthBlock();

    if (existingAuthBlocks.length <= 1) {
        return Object.values(MethodBlockAuthValues)
            .map((authType) => {
                const label = authType;
                const textEdit = getTextEditForDictionaryBlockSimpleValue(
                    line,
                    currentLineContent,
                    authType,
                );

                if (
                    authTypesWithoutAnAuthBlock.includes(authType) &&
                    existingAuthBlocks.length > 0
                ) {
                    return {
                        label,
                        textEdit,
                        additionalTextEdits: [
                            getTextEditForRemovingBlock(
                                documentHelper,
                                existingAuthBlocks[0],
                            ),
                        ].filter((val) => val != undefined),
                    };
                }

                if (
                    !authTypesWithoutAnAuthBlock.includes(authType) &&
                    existingAuthBlocks.length == 0
                ) {
                    const newAuthBlockName =
                        getExpectedAuthBlockForType(authType);
                    const authBlockKeys =
                        newAuthBlockName == AuthBlockName.OAuth2Auth
                            ? Object.values(OAuth2AuthBlocksCommonKeys)
                            : getMandatoryKeysForNonOAuth2Block(
                                  newAuthBlockName as AuthBlockNamesExcludingOAuth2,
                              );

                    return {
                        label,
                        textEdit,
                        additionalTextEdits: [
                            getTextEditForInsertingBlock(methodBlock, {
                                blockName: newAuthBlockName,
                                content: { keys: authBlockKeys },
                                lineBreak,
                            }),
                        ].filter((val) => val != undefined),
                    };
                }

                return { label, textEdit };
            })
            .filter((val) => val != undefined);
    }
}

function getCompletionsForBodyFieldValue(
    { documentHelper, position: { line } }: LanguageFeatureBaseRequest,
    allBlocks: Block[],
    methodBlock: Block,
    content: { currentLineContent: string; lineBreak: LineBreakType },
) {
    const { currentLineContent, lineBreak } = content;
    const existingBodyBlocks = allBlocks.filter(({ name }) =>
        isBodyBlock(name),
    );
    const bodyBlockTypeWithoutABodyBlock =
        getBodyBlockTypeForNoDefinedBodyBlock();

    if (existingBodyBlocks.length <= 1) {
        return Object.values(MethodBlockBodies)
            .map((bodyType) => {
                const label = bodyType;
                const textEdit = getTextEditForDictionaryBlockSimpleValue(
                    line,
                    currentLineContent,
                    bodyType,
                );
                if (!textEdit) {
                    return undefined;
                }

                if (
                    bodyType == bodyBlockTypeWithoutABodyBlock &&
                    existingBodyBlocks.length > 0
                ) {
                    return {
                        label,
                        textEdit,
                        additionalTextEdits: [
                            getTextEditForRemovingBlock(
                                documentHelper,
                                existingBodyBlocks[0],
                            ),
                        ].filter((val) => val != undefined),
                    };
                }

                if (
                    bodyType != bodyBlockTypeWithoutABodyBlock &&
                    existingBodyBlocks.length == 0
                ) {
                    const newBodyBlockName = `body:${bodyType}`;

                    return {
                        label,
                        textEdit,
                        additionalTextEdits: [
                            getTextEditForInsertingBlock(methodBlock, {
                                blockName: newBodyBlockName,
                                lineBreak,
                            }),
                        ].filter((val) => val != undefined),
                    };
                }

                return { label, textEdit };
            })
            .filter((val) => val != undefined);
    }
}

function getTextEditForRemovingBlock(
    docHelper: TextDocumentHelper,
    block: Block,
): TextEdit | undefined {
    const firstBlockLine = block.nameRange.start.line;
    const blankLinePattern = /^\s*$/m;

    const fullBlockRange = getFullBlockRange(docHelper, block);
    if (fullBlockRange == undefined) {
        return undefined;
    }

    // Remove empty lines between block and previous block, too.
    const firstLineToRemove = docHelper
        .getAllLines()
        .filter(({ index }) => index <= firstBlockLine)
        .reverse()
        .find(({ content, index }) => {
            if (index == 0) {
                return true;
            }

            const previousLineContent = docHelper.getLineByIndex(index - 1);

            return (
                (blankLinePattern.test(content) || index == firstBlockLine) &&
                !blankLinePattern.test(previousLineContent)
            );
        });

    if (!firstLineToRemove) {
        return { newText: "", range: fullBlockRange };
    }

    const rangeStart =
        firstLineToRemove.index == 0
            ? new Position(0, 0)
            : (docHelper.getRangeForLine(firstLineToRemove.index - 1)?.end ??
              new Position(firstLineToRemove.index, 0));

    return {
        newText: "",
        range: new Range(rangeStart, fullBlockRange.end),
    };
}

function getTextEditForInsertingBlock(
    methodBlock: Block,
    newData: {
        blockName: string;
        content?: { keys: string[] };
        lineBreak: LineBreakType;
    },
): TextEdit {
    const { blockName: newBlockName, content, lineBreak } = newData;

    const blockStartLine = `${newBlockName} ${BlockBracket.OpeningBracketForDictionaryOrTextBlock}`;
    const blockEndLine = BlockBracket.ClosingBracketForDictionaryOrTextBlock;
    const afterMethodBlockPosition = new Position(
        // The content range does not include the closing block bracket.
        methodBlock.contentRange.end.line + 1,
        0,
    );
    const textEditRange = new Range(
        afterMethodBlockPosition,
        afterMethodBlockPosition,
    );

    return {
        newText: lineBreak.concat(
            blockStartLine,
            lineBreak,
            content
                ? content.keys.map((key) => `\t${key}:`).join(lineBreak)
                : "\t",
            lineBreak,
            blockEndLine,
            lineBreak,
        ),
        range: textEditRange,
    };
}

function getFullBlockRange(
    docHelper: TextDocumentHelper,
    blockToReplace: Block,
) {
    const blockStartLine = blockToReplace.nameRange.start.line;
    const blockEndLine = blockToReplace.contentRange.end.line;
    const fullBlockEnd = docHelper.getRangeForLine(blockEndLine)?.end;

    return fullBlockEnd
        ? new Range(
              new Position(blockStartLine, 0),
              new Position(blockEndLine, fullBlockEnd.character),
          )
        : undefined;
}
