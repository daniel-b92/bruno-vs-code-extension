import { DictionaryBlockArrayField } from "@global_shared";
import { checkDictionaryBlockArrayFieldsValues } from "./checkDictionaryBlockArrayFieldsValues";
import { checkNoDuplicateTagsAreDefined } from "./checkNoDuplicateTagsAreDefined";

export function runChecksForTagsField(
    filePath: string,
    tagsField: DictionaryBlockArrayField,
) {
    return [
        checkDictionaryBlockArrayFieldsValues(filePath, [tagsField]),
    ].concat(checkNoDuplicateTagsAreDefined(filePath, tagsField));
}
