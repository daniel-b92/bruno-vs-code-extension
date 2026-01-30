import { BrunoVariableReference, Range } from "..";

export interface Block {
    name: string;
    nameRange: Range;
    content:
        | string
        | (
              | DictionaryBlockSimpleField
              | DictionaryBlockArrayField
              | PlainTextWithinBlock
          )[]
        | (ArrayBlockField | PlainTextWithinBlock)[];
    contentRange: Range;
    variableReferences?: BrunoVariableReference[];
}

export interface DictionaryBlock {
    name: string;
    nameRange: Range;
    content: (DictionaryBlockSimpleField | DictionaryBlockArrayField)[];
    contentRange: Range;
}

export interface DictionaryBlockSimpleField {
    key: string;
    value: string;
    keyRange: Range;
    valueRange: Range;
}

export interface DictionaryBlockArrayField {
    key: string;
    keyRange: Range;
    values: { content: string; range: Range }[];
    plainTextWithinValues: PlainTextWithinDictionaryArrayValue[];
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

export interface CodeBlock extends Block {
    content: string;
}
export interface PlainTextWithinBlock {
    text: string;
    range: Range;
}

export interface PlainTextWithinDictionaryArrayValue {
    text: string;
    range: Range;
}

export interface TextOutsideOfBlocks {
    text: string;
    range: Range;
}

export enum BlockRuntimeExecutionGroup {
    PreRequest = 1,
    Request = 2,
    PostResponse = 3,
}
