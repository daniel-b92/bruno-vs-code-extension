import { Document, LineCounter, parseDocument } from "yaml";

/** A Yaml document together with the line counter that was used for parsing it (needed to map offsets to positions). */
export interface ParsedYamlDocument {
    document: Document;
    lineCounter: LineCounter;
}

/** Syntax errors do not throw. They are available in `document.errors`. */
export function parseYamlDocument(text: string): ParsedYamlDocument {
    const lineCounter = new LineCounter();

    return { document: parseDocument(text, { lineCounter }), lineCounter };
}
