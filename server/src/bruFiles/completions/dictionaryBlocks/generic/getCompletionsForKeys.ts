import {
    Block,
    DictionaryBlockArrayField,
    DictionaryBlockSimpleField,
    getDefaultIndentationForDictionaryBlockFields,
    isArrayBlockField,
    isDictionaryBlockField,
    PlainTextWithinBlock,
    Range,
    TextDocumentHelper,
} from "@global_shared";
import {
    CompletionItem,
    InsertTextFormat,
    TextEdit,
} from "vscode-languageserver";
import { LanguageFeatureBaseRequest } from "../../../../shared";

export function getCompletionsForKeys(
    request: LanguageFeatureBaseRequest,
    block: Block,
    keysForSimpleFields: { mandatory: string[]; optional?: string[] },
    keysForArrayFields?: { optional: string[] },
): CompletionItem[] | undefined {
    const keyRangeContainingPosition = getKeyRangeContainingPosition(
        request,
        block,
    );

    if (!keyRangeContainingPosition) {
        return undefined;
    }

    return getCompletionsForSimpleFields(
        request,
        block,
        keyRangeContainingPosition,
        keysForSimpleFields,
    ).concat(
        keysForArrayFields
            ? getCompletionsForArrayFields(
                  request,
                  block,
                  keyRangeContainingPosition,
                  keysForArrayFields.optional,
              )
            : [],
    );
}

function getCompletionsForArrayFields(
    request: LanguageFeatureBaseRequest,
    block: Block,
    keyRangeContainingPosition: Range,
    optionalKeys: string[],
) {
    const forOptionalKeys: CompletionItem[] = !optionalKeys
        ? []
        : optionalKeys
              .filter(
                  (key) =>
                      !getKeysUsedInOtherLines(request, block).includes(key),
              )
              .map((key) =>
                  getCompletionItem(
                      request.documentHelper,
                      key,
                      keyRangeContainingPosition,
                      false,
                      false,
                  ),
              );

    return forOptionalKeys;
}

function getCompletionsForSimpleFields(
    request: LanguageFeatureBaseRequest,
    block: Block,
    keyRangeContainingPosition: Range,
    keys: { mandatory: string[]; optional?: string[] },
) {
    const { mandatory: mandatoryKeys, optional: optionalKeys } = keys;

    const forMandatoryKeys: CompletionItem[] = mandatoryKeys
        .filter((key) => !getKeysUsedInOtherLines(request, block).includes(key))
        .map((key) =>
            getCompletionItem(
                request.documentHelper,
                key,
                keyRangeContainingPosition,
                true,
                true,
            ),
        );

    const forOptionalKeys: CompletionItem[] = !optionalKeys
        ? []
        : optionalKeys
              .filter(
                  (key) =>
                      !getKeysUsedInOtherLines(request, block).includes(key),
              )
              .map((key) =>
                  getCompletionItem(
                      request.documentHelper,
                      key,
                      keyRangeContainingPosition,
                      true,
                      false,
                  ),
              );

    return forMandatoryKeys.concat(forOptionalKeys);
}

function getCompletionItem(
    docHelper: TextDocumentHelper,
    key: string,
    keyRangeContainingPosition: Range,
    isSimpleField: boolean,
    isMandatory: boolean,
): CompletionItem {
    return {
        label: key,
        textEdit: isSimpleField
            ? getTextEditForSimpleField(keyRangeContainingPosition, key)
            : getTextEditForArrayField(
                  docHelper,
                  keyRangeContainingPosition,
                  key,
              ),
        insertTextFormat: isSimpleField ? undefined : InsertTextFormat.Snippet,
        sortText: isMandatory ? `a_${key}` : `b_${key}`,
        labelDetails: isMandatory ? undefined : { detail: ` optional` },
    };
}

function getTextEditForArrayField(
    docHelper: TextDocumentHelper,
    existingKeyRange: Range,
    key: string,
): TextEdit {
    const defaultIndentation = getDefaultIndentationForDictionaryBlockFields();
    const lineBreak = docHelper.getMostUsedLineBreak() ?? "\n";

    return {
        newText: (existingKeyRange.start.character >=
        getDefaultIndentationForDictionaryBlockFields()
            ? key
            : " "
                  .repeat(defaultIndentation - existingKeyRange.start.character)
                  .concat(key)
        ).concat(
            `: [${lineBreak}${" ".repeat(defaultIndentation * 2)}\${0}${lineBreak}${" ".repeat(defaultIndentation)}]`,
        ),
        range: existingKeyRange,
    };
}

function getTextEditForSimpleField(
    rangeToReplace: Range,
    key: string,
): TextEdit {
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
                      .concat(`${key}:`),
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
