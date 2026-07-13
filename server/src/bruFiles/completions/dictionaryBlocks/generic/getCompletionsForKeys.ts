import {
    Block,
    getActiveKeysUsedInOtherLines,
    getDefaultIndentationForDictionaryBlockFields,
    getKeyRangeContainingPosition,
    LineBreakType,
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
    keysForSimpleFields: {
        mandatory?: string[];
        optional?: string[];
        other?: string[];
    },
    keysForArrayFields?: { optional: string[] },
): CompletionItem[] | undefined {
    const keyRangeContainingPosition = getKeyRangeContainingPosition(
        request.position,
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
    { documentHelper, position: { line } }: LanguageFeatureBaseRequest,
    block: Block,
    keyRangeContainingPosition: Range,
    optionalKeys: string[],
) {
    const forOptionalKeys: CompletionItem[] = !optionalKeys
        ? []
        : optionalKeys
              .filter(
                  (key) =>
                      !getActiveKeysUsedInOtherLines(line, block).includes(key),
              )
              .map((key) =>
                  getCompletionItem(
                      documentHelper,
                      key,
                      keyRangeContainingPosition,
                      false,
                      false,
                  ),
              );

    return forOptionalKeys;
}

function getCompletionsForSimpleFields(
    { documentHelper, position: { line } }: LanguageFeatureBaseRequest,
    block: Block,
    keyRangeContainingPosition: Range,
    keys: { mandatory?: string[]; optional?: string[]; other?: string[] },
) {
    const {
        mandatory: mandatoryKeys,
        optional: optionalKeys,
        other: otherKeys,
    } = keys;

    interface KeyWithType {
        key: string;
        type: "mandatory" | "optional" | "other";
    }

    const keysWithTypes: KeyWithType[] = (mandatoryKeys ?? [])
        .map((key) => ({ type: "mandatory", key }) as KeyWithType)
        .concat(
            (optionalKeys ?? []).map(
                (key) => ({ type: "optional", key }) as KeyWithType,
            ),
            (otherKeys ?? []).map(
                (key) => ({ type: "other", key }) as KeyWithType,
            ),
        );

    return keysWithTypes
        .filter(
            ({ key }) =>
                !getActiveKeysUsedInOtherLines(line, block).includes(key),
        )
        .map(({ key, type }) =>
            getCompletionItem(
                documentHelper,
                key,
                keyRangeContainingPosition,
                true,
                type == "mandatory"
                    ? true
                    : type == "optional"
                      ? false
                      : undefined,
            ),
        );
}

function getCompletionItem(
    docHelper: TextDocumentHelper,
    key: string,
    keyRangeContainingPosition: Range,
    isSimpleField: boolean,
    isMandatory?: boolean,
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
        labelDetails:
            isMandatory === undefined || isMandatory
                ? undefined
                : { detail: ` optional` },
    };
}

function getTextEditForArrayField(
    docHelper: TextDocumentHelper,
    existingKeyRange: Range,
    key: string,
): TextEdit {
    const defaultIndentation = getDefaultIndentationForDictionaryBlockFields();
    const lineBreak = docHelper.getMostUsedLineBreak() ?? LineBreakType.Lf;

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
