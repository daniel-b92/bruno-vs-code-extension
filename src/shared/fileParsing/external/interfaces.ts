import { Range } from "../../fileSystem/util/range";

export interface Block {
    name: string;
    nameRange: Range;
    content:
        | string
        | (DictionaryBlockField | PlainTextWithinBlock)[]
        | (ArrayBlockField | PlainTextWithinBlock)[];
    contentRange: Range;
}

export interface DictionaryBlock {
    name: string;
    nameRange: Range;
    content: DictionaryBlockField[];
    contentRange: Range;
}

export interface DictionaryBlockField {
    key: string;
    value: string;
    keyRange: Range;
    valueRange: Range;
}

export interface ArrayBlock {
    name: string;
    nameRange: Range;
    content: ArrayBlockField[];
    contentRange: Range;
}

export interface ArrayBlockField {
    entry: string;
    entryRange: Range;
}

export interface PlainTextWithinBlock {
    text: string;
    range: Range;
}

export interface TextOutsideOfBlocks {
    text: string;
    range: Range;
}
