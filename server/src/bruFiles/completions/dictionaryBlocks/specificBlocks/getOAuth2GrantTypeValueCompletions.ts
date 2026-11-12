import {
    Block,
    BooleanFieldValue,
    getMandatoryKeysForOAuth2Block,
    isDictionaryBlockField,
    LineBreakType,
    OAuth2AuthBlocksCommonKeys,
    OAuth2BlockCredentialsPlacementValue,
    OAuth2BlockTokenPlacementValue,
    OAuth2BlockTokenSourceValue,
    OAuth2GrantType,
    OAuth2ViaAuthorizationCodeBlockKeys,
} from "@global_shared";
import {
    CompletionItem,
    InsertTextFormat,
    InsertTextMode,
} from "vscode-languageserver";
import { LanguageFeatureBaseRequest } from "../../../../shared";
import { getContentForDictionaryBlock } from "../generic/getDictionaryBlockSnippetInsertionContent";
import { getLinePatternForDictionaryField } from "../generic/getLinePatternForDictionaryField";
import { getTextEditForDictionaryBlockSimpleValue } from "../generic/getTextEditForDictionaryBlockSimpleValue";

/**
 * Completions for the value of the `grant_type` field of an OAuth2 auth block.
 * In addition to the selected value, the grant type-specific mandatory fields
 * that are not yet defined are inserted (see
 * https://github.com/daniel-b92/bruno-vs-code-extension/issues/150).
 */
export function getOAuth2GrantTypeValueCompletions(
    request: LanguageFeatureBaseRequest,
    block: Block,
): CompletionItem[] | undefined {
    const {
        documentHelper,
        position: { line },
    } = request;
    const currentText = documentHelper.getLineByIndex(line);

    if (
        !currentText.match(
            getLinePatternForDictionaryField(
                OAuth2AuthBlocksCommonKeys.GrantType,
            ),
        )
    ) {
        return undefined;
    }

    const existingKeys = !Array.isArray(block.content)
        ? []
        : block.content
              .filter(isDictionaryBlockField)
              .filter(({ disabled }) => !disabled)
              .map(({ key }) => key);

    const lineBreak =
        documentHelper.getMostUsedLineBreak() ?? LineBreakType.Lf;

    return Object.values(OAuth2GrantType).map((grantType) => {
        const textEdit = getTextEditForDictionaryBlockSimpleValue(
            line,
            currentText,
            grantType,
        );

        const missingMandatoryKeys = getMandatoryKeysForOAuth2Block(
            grantType,
        ).filter(
            (key) =>
                key != OAuth2AuthBlocksCommonKeys.GrantType &&
                !existingKeys.includes(key),
        );

        if (!textEdit || missingMandatoryKeys.length == 0) {
            return { label: grantType, textEdit };
        }

        const fieldsContent = getContentForDictionaryBlock(
            missingMandatoryKeys.map((key) => ({
                key,
                predefinedValues: getPredefinedValuesForOAuth2Key(key),
            })),
            lineBreak,
        );

        return {
            label: grantType,
            textEdit: {
                ...textEdit,
                newText: `${textEdit.newText}${lineBreak}${removeOneTrailingLineBreak(fieldsContent, lineBreak)}`,
            },
            insertTextFormat: InsertTextFormat.Snippet,
            // Otherwise, VS Code would add the indentation of the current line to all subsequent lines of the snippet.
            insertTextMode: InsertTextMode.asIs,
        };
    });
}

function getPredefinedValuesForOAuth2Key(key: string): string[] | undefined {
    switch (key) {
        case OAuth2AuthBlocksCommonKeys.TokenPlacement:
            return Object.values(OAuth2BlockTokenPlacementValue);
        case OAuth2AuthBlocksCommonKeys.TokenSource:
            return Object.values(OAuth2BlockTokenSourceValue);
        case OAuth2AuthBlocksCommonKeys.AutoFetchToken:
        case OAuth2ViaAuthorizationCodeBlockKeys.Pkce:
        case OAuth2ViaAuthorizationCodeBlockKeys.AutoRefreshToken:
            return Object.values(BooleanFieldValue);
        case OAuth2ViaAuthorizationCodeBlockKeys.CredentialsPlacement:
            return Object.values(OAuth2BlockCredentialsPlacementValue);
        default:
            return undefined;
    }
}

function removeOneTrailingLineBreak(content: string, lineBreak: LineBreakType) {
    return content.endsWith(lineBreak)
        ? content.substring(0, content.length - lineBreak.length)
        : content;
}
