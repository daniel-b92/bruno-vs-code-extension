import {
    DictionaryBlockArrayField,
    DictionaryBlockSimpleField,
    isDictionaryBlockArrayField,
    isDictionaryBlockSimpleField,
    MetaBlockKey,
} from "../../..";

export function getSequenceAndTagsFromMetaBlock(
    fields: (DictionaryBlockSimpleField | DictionaryBlockArrayField)[],
) {
    const sequenceField = fields.find(
        ({ key, disabled }) => key == MetaBlockKey.Sequence && !disabled,
    );
    const tagsField = fields.find(
        ({ key, disabled }) => key == MetaBlockKey.Tags && !disabled,
    );

    return {
        sequence:
            sequenceField &&
            isDictionaryBlockSimpleField(sequenceField) &&
            !isNaN(Number(sequenceField.value))
                ? Number(sequenceField.value)
                : undefined,
        tags:
            tagsField && isDictionaryBlockArrayField(tagsField)
                ? tagsField.values.map(({ content }) => content)
                : undefined,
    };
}
