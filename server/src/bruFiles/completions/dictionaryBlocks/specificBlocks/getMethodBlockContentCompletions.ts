import {
    MethodBlockKey,
    MethodBlockBodies,
    Block,
    getMandatoryKeysForMethodBlock,
    LineBreakType,
    isBodyBlock,
    canBlockBeDefinedMultipleTimes,
    getBodyBlockTypeForNoDefinedBodyBlock,
} from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../../../shared";
import { getLinePatternForDictionaryField } from "../generic/getLinePatternForDictionaryField";

import { getCompletionsForKeys } from "../generic/getCompletionsForKeys";
import { getTextEditForDictionaryBlockSimpleValue } from "../generic/getTextEditForDictionaryBlockSimpleValue";
import { CompletionItem } from "vscode-languageserver";
import { getTextEditForInsertingBlock } from "../../../shared/getTextEditForInsertingBlock";
import { getTextEditForRemovingBlock } from "../../../shared/getTextEditForRemovingBlock";
import { getCompletionsForAuthTypeFieldValue } from "../generic/getCompletionsForAuthTypeFieldValue";

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
        return getCompletionsForAuthTypeFieldValue(
            baseRequest,
            allBlocks,
            methodBlock,
            { currentLineContent: currentText, lineBreak },
            false,
        );
    }

    return getCompletionsForBodyFieldValue(
        baseRequest,
        allBlocks,
        methodBlock,
        { currentLineContent: currentText, lineBreak },
    );
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

    // Multiple blocks that can be repeated (e.g. websocket messages) together count as a single body.
    const hasAtMostOneBody =
        existingBodyBlocks.length <= 1 ||
        existingBodyBlocks.every(({ name }) =>
            canBlockBeDefinedMultipleTimes(name),
        );

    if (hasAtMostOneBody) {
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
                        additionalTextEdits: existingBodyBlocks
                            .map((block) =>
                                getTextEditForRemovingBlock(
                                    documentHelper,
                                    block,
                                ),
                            )
                            .filter((val) => val != undefined),
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
