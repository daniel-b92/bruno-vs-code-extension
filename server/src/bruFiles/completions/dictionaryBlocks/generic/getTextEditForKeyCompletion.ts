import {
    getDefaultIndentationForDictionaryBlockFields,
    Range,
} from "@global_shared";
import { TextEdit } from "vscode-languageserver";

export function getTextEditForKeyCompletion(
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
                      .concat(key),
        range: rangeToReplace,
    };
}
