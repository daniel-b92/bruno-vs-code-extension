import { Range } from "vscode";

export interface RequestFileBlock {
    name: string;
    nameRange: Range;
    content: string | DictionaryBlockField[];
    contentRange: Range;
}

export interface DictionaryBlockField {
    name: string;
    value: string;
    nameRange: Range;
    valueRange: Range;
}

export interface TextOutsideOfBlocks {
    text: string;
    range: Range;
}
