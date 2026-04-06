import {
    Block,
    DictionaryBlockArrayField,
    DictionaryBlockSimpleField,
    getDefaultIndentationForDictionaryBlockFields,
    isArrayBlockField,
    isDictionaryBlockField,
    PlainTextWithinBlock,
    Range,
} from "@global_shared";
import { CompletionItem, TextEdit } from "vscode-languageserver";
import { LanguageFeatureBaseRequest } from "../../../../shared";

export function getCompletionsForKeys(
    request: LanguageFeatureBaseRequest,
    block: Block,
    mandatoryKeys: string[],
    optionalKeys?: string[],
): CompletionItem[] | undefined {
    const keyRangeContainingPosition = getKeyRangeContainingPosition(
        request,
        block,
    );

    if (!keyRangeContainingPosition) {
        return undefined;
    }

    const forMandatoryKeys = mandatoryKeys
        .filter((key) => !getKeysUsedInOtherLines(request, block).includes(key))
        .map((key) => ({
            label: key,
            textEdit: getTextEdit(keyRangeContainingPosition, key),
            sortText: `a_${key}`,
        }));

    const forOptionalKeys = !optionalKeys
        ? []
        : optionalKeys
              .filter(
                  (key) =>
                      !getKeysUsedInOtherLines(request, block).includes(key),
              )
              .map((key) => ({
                  label: key,
                  textEdit: getTextEdit(keyRangeContainingPosition, key),
                  sortText: `b_${key}`,
              }));

    return forMandatoryKeys.concat(forOptionalKeys);
}

function getTextEdit(rangeToReplace: Range, key: string): TextEdit {
    return {
        newText:
            rangeToReplace.start.character >=
            getDefaultIndentationForDictionaryBlockFields()
                ? key
                : " "
                      .repeat(
                          getDefaultIndentationForDictionaryBlockFields() -
                              rangeToReplace.start.character,
                      )
                      .concat(key),
        range: rangeToReplace,
    };
}

function getKeyRangeContainingPosition(
    { position }: LanguageFeatureBaseRequest,
    block: Block,
) {
    const { content: blockContent } = block;
    if (!Array.isArray(blockContent)) {
        return undefined;
    }

    const field = blockContent
        .filter((field) => !isArrayBlockField(field))
        .find((field) => {
            if (
                isArrayBlockField(field) ||
                (isDictionaryBlockField(field) && field.disabled)
            ) {
                return false;
            }

            if (!isDictionaryBlockField(field)) {
                return field.range.contains(position);
            }

            return field.keyRange.contains(position);
        }) as
        | PlainTextWithinBlock
        | DictionaryBlockSimpleField
        | DictionaryBlockArrayField
        | undefined;

    return !field
        ? undefined
        : isDictionaryBlockField(field)
          ? field.keyRange
          : field.range;
}

function getKeysUsedInOtherLines(
    { position: { line } }: LanguageFeatureBaseRequest,
    { content: blockContent }: Block,
) {
    return !Array.isArray(blockContent)
        ? []
        : blockContent
              .filter((field) => isDictionaryBlockField(field))
              .filter(({ keyRange: { start } }) => start.line != line)
              .map(({ key }) => key);
}
