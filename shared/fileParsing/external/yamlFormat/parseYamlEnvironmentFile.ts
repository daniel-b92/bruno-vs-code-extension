import { LineCounter, parseDocument } from "yaml";

export function parseYamlEnvironmentFile(content: string) {
    const document = parseDocument(content, { lineCounter: new LineCounter() });

    return document.toJS();
}
