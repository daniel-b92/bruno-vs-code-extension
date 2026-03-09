import {
    MetaBlockKey,
    isDictionaryBlockField,
    Block,
    isDictionaryBlockSimpleField,
} from "../../..";

export function getSequenceValueFromMetaBlock({
    content: metaBlockContent,
}: Block) {
    const sequenceField =
        metaBlockContent &&
        Array.isArray(metaBlockContent) &&
        metaBlockContent.length > 0 &&
        metaBlockContent.every((content) => isDictionaryBlockField(content))
            ? metaBlockContent.find(
                  ({ key, disabled }) =>
                      key == MetaBlockKey.Sequence && !disabled,
              )
            : undefined;

    return sequenceField &&
        isDictionaryBlockSimpleField(sequenceField) &&
        !isNaN(Number(sequenceField.value))
        ? Number(sequenceField.value)
        : undefined;
}
