import { Range } from "vscode";

export interface RequestFileSection {
    type: string;
    range: Range;
    content: string | RequestFileSectionField[];
}

export interface RequestFileSectionField {
    name: string;
    value: string;
    range: Range;
}
