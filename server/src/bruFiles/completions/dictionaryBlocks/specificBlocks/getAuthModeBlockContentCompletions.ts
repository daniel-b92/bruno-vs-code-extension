import { Block, AuthModeBlockKey, LineBreakType } from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../../../shared";
import { getLinePatternForDictionaryField } from "../generic/getLinePatternForDictionaryField";
import { getCompletionsForKeys } from "../generic/getCompletionsForKeys";
import { CompletionItem } from "vscode-languageserver";
import { getCompletionsForAuthTypeFieldValue } from "../generic/getCompletionsForAuthTypeFieldValue";

export function getAuthModeBlockContentCompletions(
    request: LanguageFeatureBaseRequest,
    allBlocks: Block[],
    block: Block,
) {
    const completionsForKeys = getCompletionsForKeys(request, block, {
        mandatory: [AuthModeBlockKey.Mode],
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
    authModeBlock: Block,
    allBlocks: Block[],
    baseRequest: LanguageFeatureBaseRequest,
    lineBreak: LineBreakType,
): CompletionItem[] | undefined {
    const {
        documentHelper,
        position: { line },
    } = baseRequest;
    const currentText = documentHelper.getLineByIndex(line);

    const isInAuthModeField = getLinePatternForDictionaryField(
        AuthModeBlockKey.Mode,
    ).test(currentText);

    if (!isInAuthModeField) {
        return undefined;
    }

    return getCompletionsForAuthTypeFieldValue(
        baseRequest,
        allBlocks,
        authModeBlock,
        { currentLineContent: currentText, lineBreak },
    );
}
