import {
    Block,
    getActiveKeysUsedInOtherLines,
    getKeyRangeContainingPosition,
    LineBreakType,
    Range,
    TextDocumentHelper,
} from "@global_shared";
import { CompletionItem, InsertTextFormat } from "vscode-languageserver";
import { LanguageFeatureBaseRequest } from "../../../../shared";
import { getTextEditForKey } from "./getTextEditForKey";

export function getCompletionsForKeys(
    request: LanguageFeatureBaseRequest,
    block: Block,
    keysForSimpleFields: {
        mandatory: string[];
        optional?: string[];
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
    keys: { mandatory: string[]; optional?: string[] },
) {
    const { mandatory: mandatoryKeys, optional: optionalKeys } = keys;

    interface KeyWithType {
        key: string;
        type: "mandatory" | "optional";
    }

    const keysWithTypes: KeyWithType[] = (mandatoryKeys ?? [])
        .map((key) => ({ type: "mandatory", key }) as KeyWithType)
        .concat(
            (optionalKeys ?? []).map(
                (key) => ({ type: "optional", key }) as KeyWithType,
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
    const lineBreak = docHelper.getMostUsedLineBreak() ?? LineBreakType.Lf;

    return {
        label: key,
        textEdit: getTextEditForKey(
            lineBreak,
            keyRangeContainingPosition,
            key,
            isSimpleField,
        ),
        insertTextFormat: isSimpleField ? undefined : InsertTextFormat.Snippet,
        sortText: isMandatory ? `a_${key}` : `b_${key}`,
        labelDetails:
            isMandatory === undefined || isMandatory
                ? undefined
                : { detail: ` optional` },
    };
}
