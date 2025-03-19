import { Range } from "vscode";

export interface RequestFileBlock {
    type: string;
    range: Range;
    content: string | DictionaryBlockField[];
}

export interface DictionaryBlockField {
    name: string;
    value: string;
    range: Range;
}
