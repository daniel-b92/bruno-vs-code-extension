import {
    MethodBlockKey,
    MethodBlockBodies,
    MethodBlockAuthValues,
    Block,
    getMandatoryKeysForMethodBlock,
    Range,
    Position,
    TextDocumentHelper,
    RequestFileBlockName,
    isAuthBlock,
    AuthBlockName,
    OAuth2AuthBlocksCommonKeys,
    getMandatoryKeysForNonOAuth2Block,
    AuthBlockNamesExcludingOAuth2,
    LineBreakType,
    BlockBracket,
    getExpectedAuthBlockForType,
    isBodyBlock,
} from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../../../shared";
import { getFixedCompletionItems } from "../generic/getFixedCompletionItems";
import { getLinePatternForDictionaryField } from "../generic/getLinePatternForDictionaryField";

import { getCompletionsForKeys } from "../generic/getCompletionsForKeys";
import { getTextEditForDictionaryBlockSimpleValue } from "../generic/getTextEditForDictionaryBlockSimpleValue";
import { CompletionItem, TextEdit } from "vscode-languageserver";

const fieldType = {
    Auth: MethodBlockKey.Auth,
    Body: MethodBlockKey.Body,
} as const;

export function getMethodBlockContentCompletions(
    request: LanguageFeatureBaseRequest,
    block: Block,
) {
    const completionsForKeys = getCompletionsForKeys(request, block, {
        mandatory: getMandatoryKeysForMethodBlock(block.name),
    });

    if (completionsForKeys) {
        return completionsForKeys;
    }

    return getFixedCompletionItems(
        [
            {
                linePattern: getLinePatternForDictionaryField(
                    MethodBlockKey.Body,
                ),
                choices: Object.values(MethodBlockBodies),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    MethodBlockKey.Auth,
                ),
                choices: Object.values(MethodBlockAuthValues),
            },
        ],
        request,
    );
}

export function getValueCompletions(
    methodBlock: Block,
    allBlocks: Block[],
    { documentHelper, position: { line } }: LanguageFeatureBaseRequest,
    lineBreak: LineBreakType,
): CompletionItem[] {
    const currentText = documentHelper.getLineByIndex(line);

    const isInAuthField =
        currentText.match(getLinePatternForDictionaryField(MethodBlockKey.Auth))
            ?.length ?? -1 > 0;

    if (isInAuthField) {
        const existingAuthBlocks = allBlocks.filter(({ name }) =>
            isAuthBlock(name),
        );

        if (existingAuthBlocks.length <= 1) {
            return Object.values(MethodBlockAuthValues).map((authType) => {
                const newAuthBlockName = getExpectedAuthBlockForType(authType);
                const authBlockKeys =
                    newAuthBlockName == AuthBlockName.OAuth2Auth
                        ? Object.values(OAuth2AuthBlocksCommonKeys)
                        : getMandatoryKeysForNonOAuth2Block(
                              newAuthBlockName as AuthBlockNamesExcludingOAuth2,
                          );

                return {
                    label: authType,
                    textEdit: getTextEditForDictionaryBlockSimpleValue(
                        line,
                        currentText,
                        authType,
                    ),
                    additionalTextEdits: getAdditionalTextEdits(
                        documentHelper,
                        methodBlock,
                        {
                            blockName: newAuthBlockName,
                            keys: authBlockKeys,
                            lineBreak,
                        },
                    ),
                };
            });
        }
    }

    const isInBodyField =
        currentText.match(getLinePatternForDictionaryField(MethodBlockKey.Body))
            ?.length ?? -1 > 0;

    if (isInBodyField) {
        const existingBodyBlocks = allBlocks.filter(({ name }) =>
            isBodyBlock(name),
        );

        if (existingBodyBlocks.length <= 1) {
            return Object.values(MethodBlockBodies).map((bodyType) => {
                const newBodyBlockName = `body:${bodyType}`;

                return {
                    label: bodyType,
                    textEdit: getTextEditForDictionaryBlockSimpleValue(
                        line,
                        currentText,
                        bodyType,
                    ),
                    additionalTextEdits: getAdditionalTextEdits(
                        documentHelper,
                        methodBlock,
                        {
                            blockName: newBodyBlockName,
                            keys: authBlockKeys,
                            lineBreak,
                        },
                    ),
                };
            });
        }
    }
}

function getAdditionalTextEdits(
    docHelper: TextDocumentHelper,
    methodBlock: Block,
    newData: {
        blockName: string;
        keys: string[];
        lineBreak: LineBreakType;
    },
    blockToReplace?: Block,
): TextEdit[] | undefined {
    const { blockName: newBlockName, keys: newKeys, lineBreak } = newData;

    const blockStartLine = `${newBlockName} ${BlockBracket.OpeningBracketForDictionaryOrTextBlock}${lineBreak}`;
    const blockEndLine = BlockBracket.ClosingBracketForDictionaryOrTextBlock;
    const commonText = blockStartLine.concat(
        lineBreak,
        newKeys.map((key) => `\t${key}:`).join(lineBreak),
        lineBreak,
        blockEndLine,
    );

    if (blockToReplace != undefined) {
        const range = getFullBlockRange(docHelper, blockToReplace);
        return range ? [{ newText: commonText, range }] : undefined;
    }

    const afterMethodBlockPosition = new Position(
        methodBlock.contentRange.end.line,
        0,
    );

    return [
        {
            newText: lineBreak.concat(commonText, lineBreak),
            range: new Range(
                afterMethodBlockPosition,
                afterMethodBlockPosition,
            ),
        },
    ];
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
