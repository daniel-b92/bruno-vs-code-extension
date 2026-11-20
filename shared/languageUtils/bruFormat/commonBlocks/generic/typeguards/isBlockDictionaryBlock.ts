import {
    Block,
    DictionaryBlock,
    isDictionaryBlockField,
    isDictionaryBlockTypeAnnotation,
} from "../../../../..";
import { isDictionaryBlockDescription } from "../../../genericFields/typeguards/isDictionaryBlockDescription";

export function isBlockDictionaryBlock(block: Block): block is DictionaryBlock {
    return (
        Array.isArray(block.content) &&
        block.content.length > 0 &&
        block.content.every(
            (field) =>
                isDictionaryBlockField(field) ||
                isDictionaryBlockDescription(field) ||
                isDictionaryBlockTypeAnnotation(field),
        )
    );
}
