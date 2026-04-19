import {
    MethodBlockKey,
    MethodBlockBodies,
    MethodBlockAuthValues,
    Block,
    getMandatoryKeysForMethodBlock,
    isAuthBlock,
    AuthBlockName,
    OAuth2AuthBlocksCommonKeys,
    getMandatoryKeysForNonOAuth2Block,
    AuthBlockNamesExcludingOAuth2,
    LineBreakType,
    getExpectedAuthBlockForType,
    isBodyBlock,
    getAuthTypesForNoDefinedAuthBlock,
    getBodyBlockTypeForNoDefinedBodyBlock,
} from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../../../shared";
import { getLinePatternForDictionaryField } from "../generic/getLinePatternForDictionaryField";

import { getCompletionsForKeys } from "../generic/getCompletionsForKeys";
import { getTextEditForDictionaryBlockSimpleValue } from "../generic/getTextEditForDictionaryBlockSimpleValue";
import { CompletionItem } from "vscode-languageserver";
import { getTextEditForInsertingBlock } from "../../../shared/getTextEditForInsertingBlock";
import { getTextEditForRemovingBlock } from "../../../shared/getTextEditForRemovingBlock";

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
