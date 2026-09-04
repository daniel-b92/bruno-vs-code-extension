import { describe, it, expect } from "@jest/globals";
import {
    DictionaryBlockTypeAnnotationValue,
    Position,
    Range,
    TextDocumentHelper,
} from "../../..";
import { parseDictionaryBlock } from "./parseDictionaryBlock";

describe("parseDictionaryBlock", () => {
    it("parses a dictionary block with a simple field, that has a description and a type annotation and one without", () => {
        const blockContent = `block {
  key1: value 1
  @description("first")
  @number
  key2: value2
}`;
        const docHelper = new TextDocumentHelper(blockContent);
        const result = parseDictionaryBlock(docHelper, 1, 4);

        expect(result).toBeDefined();
        const { content, contentRange } = result!;

        expect(contentRange).toEqual(
            new Range(new Position(1, 0), new Position(5, 0)),
        );

        expect(content).toHaveLength(4);
        expect(content).toContainEqual({
            disabled: false,
            key: "key1",
            keyRange: getRangeForKey(1, "key1", 2),
            value: "value 1",
            valueRange: getRangeForSingleLineValue(1, "key1", "value 1", 2),
        });
        expect(content).toContainEqual({
            range: new Range(
                new Position(2, 2),
                new Position(2, 2 + '@description("first")'.length),
            ),
        });
        expect(content).toContainEqual({
            range: new Range(
                new Position(3, 2),
                new Position(3, 2 + "@number".length),
            ),
            value: DictionaryBlockTypeAnnotationValue.Number,
        });
        expect(content).toContainEqual({
            disabled: false,
            key: "key2",
            keyRange: getRangeForKey(4, "key2", 2),
            value: "value2",
            valueRange: getRangeForSingleLineValue(4, "key2", "value2", 2),
        });
    });

    it("parses a dictionary block with a simple field with multiple descriptions and type annotations", () => {
        const blockContent = `block {
  @description("first")
  @number
  @object
  @description('other bla')
  key2: value2
}`;
        const docHelper = new TextDocumentHelper(blockContent);
        const result = parseDictionaryBlock(docHelper, 1, 5);

        expect(result).toBeDefined();
        const { content, contentRange } = result!;

        expect(contentRange).toEqual(
            new Range(new Position(1, 0), new Position(6, 0)),
        );

        expect(content).toHaveLength(5);
        expect(content).toContainEqual({
            range: new Range(
                new Position(1, 2),
                new Position(1, 2 + '@description("first")'.length),
            ),
        });
        expect(content).toContainEqual({
            range: new Range(
                new Position(2, 2),
                new Position(2, 2 + "@number".length),
            ),
            value: DictionaryBlockTypeAnnotationValue.Number,
        });
        expect(content).toContainEqual({
            range: new Range(
                new Position(3, 2),
                new Position(3, 2 + "@object".length),
            ),
            value: DictionaryBlockTypeAnnotationValue.Object,
        });
        expect(content).toContainEqual({
            range: new Range(
                new Position(4, 2),
                new Position(4, 2 + "@description('other bla')".length),
            ),
        });
        expect(content).toContainEqual({
            disabled: false,
            key: "key2",
            keyRange: getRangeForKey(5, "key2", 2),
            value: "value2",
            valueRange: getRangeForSingleLineValue(5, "key2", "value2", 2),
        });
    });

    it("parses a dictionary block with an array field", () => {
        const blockContent = `block {
  key1: [
    val aaas
    val 22
  ]
}`;
        const docHelper = new TextDocumentHelper(blockContent);
        const result = parseDictionaryBlock(docHelper, 1, 4);

        expect(result).toBeDefined();
        const { content } = result!;

        expect(content).toHaveLength(1);
        expect(content[0]).toEqual({
            disabled: false,
            key: "key1",
            keyRange: getRangeForKey(1, "key1", 2),
            values: [
                {
                    content: "val aaas",
                    range: new Range(
                        new Position(2, 4),
                        new Position(2, 4 + "val aaas".length),
                    ),
                },
                {
                    content: "val 22",
                    range: new Range(
                        new Position(3, 4),
                        new Position(3, 4 + "val 22".length),
                    ),
                },
            ],
            arrayRange: {
                start: new Position(1, 2 + "key1".length + 3),
                end: new Position(4, 2),
            },
            plainTextWithinValues: [],
        });
    });
});

function getRangeForKey(line: number, keyContent: string, startChar = 2) {
    return new Range(
        new Position(line, startChar),
        new Position(line, startChar + keyContent.length),
    );
}

function getRangeForSingleLineValue(
    line: number,
    keyContent: string,
    valueContent: string,
    keyStartChar = 2,
) {
    const startPosition = new Position(
        line,
        keyStartChar + keyContent.length + 2,
    );
    return new Range(
        startPosition,
        new Position(line, startPosition.character + valueContent.length),
    );
}
