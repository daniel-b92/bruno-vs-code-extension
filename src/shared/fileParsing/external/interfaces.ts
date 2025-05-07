import { Range } from "vscode";

export interface Block {
    name: string;
    nameRange: Range;
    content: string | DictionaryBlockField[] | ArrayBlockField[];
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

export interface TextOutsideOfBlocks {
    text: string;
    range: Range;
}
