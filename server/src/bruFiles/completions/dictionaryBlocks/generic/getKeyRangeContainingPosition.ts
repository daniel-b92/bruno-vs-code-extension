import {
    Block,
    DictionaryBlockArrayField,
    DictionaryBlockSimpleField,
    isArrayBlockField,
    isDictionaryBlockField,
    PlainTextWithinBlock,
} from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../../../shared";

export function getKeyRangeContainingPosition(
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
