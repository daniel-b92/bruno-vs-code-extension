import { LineCounter, parseDocument } from "yaml";
import {
    Position,
    Range,
    TextDocumentHelper,
    YamlExpectedKeyInfo,
    YamlMapDescriptor,
} from "..";
import { CommonParsingArgs } from "../fileParsing/internal/yamlFormat/interfaces";

export function getExpectedKeyRange(
    line: number,
    key: string,
    keyStartChar = 4,
) {
    return new Range(
        new Position(line, keyStartChar),
        new Position(line, keyStartChar + key.length),
    );
}

export function getExpectedSameLineValueRange(
    line: number,
    key: string,
    value: string,
    keyStartChar = 4,
) {
    return new Range(
        // The '+2' is for the ': ' between the key and the value.
        new Position(line, keyStartChar + key.length + 2),
        new Position(line, keyStartChar + key.length + 2 + value.length),
    );
}

export function parseTextIntoYamlDocument(text: string) {
    return parseDocument(text, {
        lineCounter: new LineCounter(),
    });
}

/** The returned args collect a descriptor for every map that gets validated while parsing. */
export function makeCommonParsingArgs(
    documentText: string,
): CommonParsingArgs & { mapDescriptors: YamlMapDescriptor[] } {
    const docHelper = new TextDocumentHelper(documentText);
    return {
        docHelper,
        fullDocumentRange: docHelper.getTextRange(),
        mapDescriptors: [],
    };
}

/** The expected keys of a map that are not defined in it. */
export function getMissingKeys({
    definedKeys,
    expectedKeys,
}: YamlMapDescriptor): YamlExpectedKeyInfo[] {
    const definedKeyNames = definedKeys.map(({ key }) => key);
    return expectedKeys.filter(({ key }) => !definedKeyNames.includes(key));
}
