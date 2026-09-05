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

    it("parses a dictionary block with plain text in one line", () => {
        const blockContent = `block {
  key1: value 1
  bla asas
}`;
        const docHelper = new TextDocumentHelper(blockContent);
        const result = parseDictionaryBlock(docHelper, 1, 2);

        expect(result).toBeDefined();
        const { content, contentRange } = result!;

        expect(contentRange).toEqual(
            new Range(new Position(1, 0), new Position(3, 0)),
        );

        expect(content).toHaveLength(2);
        expect(content).toContainEqual({
            disabled: false,
            key: "key1",
            keyRange: getRangeForKey(1, "key1", 2),
            value: "value 1",
            valueRange: getRangeForSingleLineValue(1, "key1", "value 1", 2),
        });
        expect(content).toContainEqual({
            text: "  bla asas",
            range: new Range(
                new Position(2, 0),
                new Position(2, 2 + "bla asas".length),
            ),
        });
    });

    it("parses a dictionary block with different types of disabled fields", () => {
        const blockContent = `block {
  ~key1: value 1
  ~arr1: [
    val 11
  ]
  ~arr2: '''
    vasas
  '''
}`;
        const docHelper = new TextDocumentHelper(blockContent);
        const result = parseDictionaryBlock(docHelper, 1, 7);

        expect(result).toBeDefined();
        const { content, contentRange } = result!;

        expect(contentRange).toEqual(
            new Range(new Position(1, 0), new Position(8, 0)),
        );

        expect(content).toHaveLength(3);
        expect(content).toContainEqual({
            disabled: true,
            key: "key1",
            keyRange: getRangeForKey(1, "key1", 3),
            value: "value 1",
            valueRange: getRangeForSingleLineValue(1, "key1", "value 1", 3),
        });
        expect(content).toContainEqual({
            disabled: true,
            key: "arr1",
            keyRange: getRangeForKey(2, "arr1", 3),
            values: [
                {
                    content: "val 11",
                    range: new Range(
                        new Position(3, 4),
                        new Position(3, 4 + "val 11".length),
                    ),
                },
            ],
            arrayRange: {
                start: new Position(2, 3 + "arr1".length + 3),
                end: new Position(4, 2),
            },
            plainTextWithinValues: [],
        });
        expect(content).toContainEqual({
            disabled: true,
            key: "arr2",
            keyRange: getRangeForKey(5, "arr2", 3),
            value: "'''\n    vasas\n  '''",
            valueRange: new Range(
                new Position(5, 3 + "arr2: ".length),
                new Position(7, 5),
            ),
            multilineValueSpecificData: {},
        });
    });

    it("parses a dictionary block with a multiline description with invalid text in opening and closing line", () => {
        const blockContent = `block {
  @description(''' first line
    vasas
  last line ''') bla
}`;
        const docHelper = new TextDocumentHelper(blockContent);
        const result = parseDictionaryBlock(docHelper, 1, 3);

        expect(result).toBeDefined();
        const { content } = result!;

        expect(content).toHaveLength(1);
        expect(content[0]).toEqual({
            range: new Range(
                new Position(1, "  @description(".length),
                new Position(3, "  last line '''".length),
            ),
            multilineValueSpecificData: {
                invalidIncludedTextInOpeningLine: new Range(
                    new Position(
                        1,
                        docHelper.getLineByIndex(1).indexOf("first line"),
                    ),
                    docHelper.getRangeForLine(1)!.end,
                ),
                invalidIncludedTextInClosingLine: new Range(
                    new Position(3, 2),
                    new Position(3, "  last line".length),
                ),
                tailingTextAfterClosingQuotes: new Range(
                    new Position(3, docHelper.getLineByIndex(3).indexOf(")")),
                    docHelper.getRangeForLine(3)!.end,
                ),
            },
        });
    });

    it("parses a dictionary block with a multiline description without closing quotes", () => {
        const blockContent = `block {
  @description('''
    vasas
    last line
}`;
        const docHelper = new TextDocumentHelper(blockContent);
        const result = parseDictionaryBlock(docHelper, 1, 3);

        expect(result).toBeDefined();
        const { content } = result!;

        expect(content).toHaveLength(1);
        expect(content[0]).toEqual({
            range: new Range(
                new Position(1, "  @description(".length),
                new Position(3, "    last line".length),
            ),
            multilineValueSpecificData: { err: "missingClosingQuotes" },
        });
    });

    it("parses a dictionary block with a simple field with multiline value without closing quotes", () => {
        const blockContent = `block {
  arr2: '''
    vasas
    asas
}`;
        const docHelper = new TextDocumentHelper(blockContent);
        const result = parseDictionaryBlock(docHelper, 1, 3);

        expect(result).toBeDefined();
        const { content } = result!;

        expect(content).toHaveLength(1);
        expect(content[0]).toEqual({
            disabled: false,
            key: "arr2",
            keyRange: getRangeForKey(1, "arr2", 2),
            value: "'''\n    vasas\n    asas",
            valueRange: new Range(
                new Position(1, 2 + "arr2: ".length),
                new Position(3, 4 + "asas".length),
            ),
            multilineValueSpecificData: { err: "missingClosingQuotes" },
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
