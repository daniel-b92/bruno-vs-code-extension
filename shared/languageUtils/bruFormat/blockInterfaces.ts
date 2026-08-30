import { BrunoVariableReference, Position, Range } from "../..";

export interface Block {
    name: string;
    nameRange: Range;
    content:
        | string
        | (
              | DictionaryBlockSimpleField
              | DictionaryBlockArrayField
              | DictionaryBlockDescription
              | DictionaryBlockTypeAnnotation
              | PlainTextWithinBlock
          )[]
        | (ArrayBlockField | PlainTextWithinBlock)[];
    contentRange: Range;
    variableReferences?: BrunoVariableReference[];
}

export interface DictionaryBlock {
    name: string;
    nameRange: Range;
    content: (
        | DictionaryBlockSimpleField
        | DictionaryBlockArrayField
        | DictionaryBlockDescription
        | DictionaryBlockTypeAnnotation
    )[];
    contentRange: Range;
}

export type DictionaryBlockSimpleField = DictionaryBlockField & {
    value: string;
    valueRange: Range;
    multilineValueSpecificData?: MultilineValueAdditionalData;
};

export type DictionaryBlockArrayField = DictionaryBlockField & {
    values: { content: string; range: Range }[];
    arrayRange: { start: Position; end?: Position };
    plainTextWithinValues: PlainTextWithinDictionaryArrayValue[];
};

export interface DictionaryBlockDescription {
    range: Range;
}

export interface DictionaryBlockTypeAnnotation {
    range: Range;
    value: DictionaryBlockTypeAnnotationValue;
}

export type MultilineValueAdditionalData =
    | { err: "missingClosingQuotes" }
    | {
          textInLineWithOpeningQuotes?: Range;
          textInLineWithClosingQuotes?: Range;
          tailingTextAfterClosingQuotes?: Range;
      };

export enum DictionaryBlockTypeAnnotationValue {
    Number = "number",
    Boolean = "boolean",
    Object = "object",
}

interface DictionaryBlockField {
    disabled: boolean;
    key: string;
    keyRange: Range;
}

export interface ArrayBlock {
    name: string;
    nameRange: Range;
    content: ArrayBlockField[];
    contentRange: Range;
}

export interface ArrayBlockField {
    disabled: boolean;
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
