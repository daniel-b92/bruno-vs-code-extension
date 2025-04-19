import { Range } from "vscode";

export interface RequestFileBlock {
    name: string;
    nameRange: Range;
    content: string | DictionaryBlockField[];
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

export interface TextOutsideOfBlocks {
    text: string;
    range: Range;
}
