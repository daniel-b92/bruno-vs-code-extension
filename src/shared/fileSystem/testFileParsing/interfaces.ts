import { Range } from "vscode";

export interface RequestFileBlock {
    name: string;
    range: Range;
    content: string | DictionaryBlockField[];
}

export interface DictionaryBlockField {
    name: string;
    value: string;
    nameRange: Range;
    valueRange: Range;
}
