import {
    getDefaultIndentationForDictionaryBlockFields,
    LineBreakType,
    Range,
} from "@global_shared";
import { TextEdit } from "vscode-languageserver";

export function getTextEditForKey(
    lineBreak: LineBreakType,
    existingKeyRange: Range,
    newKey: string,
    isSimpleField: boolean,
): TextEdit {
    return isSimpleField
        ? getTextEditForSimpleField(existingKeyRange, newKey)
        : getTextEditForArrayField(lineBreak, existingKeyRange, newKey);
}

function getTextEditForArrayField(
    lineBreak: LineBreakType,
    existingKeyRange: Range,
    newKey: string,
): TextEdit {
    const defaultIndentation = getDefaultIndentationForDictionaryBlockFields();

    return {
        newText: (existingKeyRange.start.character >=
        getDefaultIndentationForDictionaryBlockFields()
            ? newKey
            : " "
                  .repeat(defaultIndentation - existingKeyRange.start.character)
                  .concat(newKey)
        ).concat(
            `: [${lineBreak}${" ".repeat(defaultIndentation * 2)}\${0}${lineBreak}${" ".repeat(defaultIndentation)}]`,
        ),
        range: existingKeyRange,
    };
}

function getTextEditForSimpleField(
    rangeToReplace: Range,
    newKey: string,
): TextEdit {
    return {
        newText:
            rangeToReplace.start.character >=
            getDefaultIndentationForDictionaryBlockFields()
                ? newKey
                : " "
                      .repeat(
                          getDefaultIndentationForDictionaryBlockFields() -
                              rangeToReplace.start.character,
                      )
                      .concat(`${newKey}:`),
        range: rangeToReplace,
    };
}
