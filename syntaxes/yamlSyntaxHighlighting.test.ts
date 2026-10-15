import { describe, it, expect } from "@jest/globals";
import {
    getLanguagesPerLine,
    stubStringScope,
    tokenizeYaml,
} from "./_testingUtils/tokenizeYaml";

describe("Yaml syntax highlighting", () => {
    describe("scripts", () => {
        it.each(["runtime", "request"])(
            "highlights script code in the '%s' section as Javascript",
            async (section) => {
                await expectLanguages([
                    ["yaml", `${section}:`],
                    ["yaml", "  scripts:"],
                    ["yaml", "    - type: before-request"],
                    ["yaml", "      code: |-"],
                    ["javascript", '        bru.setVar("a", 1);'],
                    ["javascript", "        const b = 2;"],
                    ["yaml", "    - type: tests"],
                    ["yaml", "      code: eee"],
                ]);
            },
        );

        it("does not let an unclosed string leak beyond the end of the block scalar", async () => {
            await expectLanguages([
                ["yaml", "runtime:"],
                ["yaml", "  scripts:"],
                ["yaml", "    - type: before-request"],
                ["yaml", "      code: |"],
                ["javascript", '        const a = "unclosed;'],
                ["", ""],
                ["yaml", "    - type: tests"],
                ["yaml", "      code: |+"],
                ["javascript", "        test();"],
            ]);
        });

        it("does not highlight 'code' fields outside of known sections", async () => {
            await expectLanguages([
                ["yaml", "settings:"],
                ["yaml", "  code: |"],
                ["yaml", "    const a = 1;"],
            ]);
        });
    });

    describe("bodies", () => {
        it.each([
            ["json", "json", '{ "foo": "bar" }'],
            ["xml", "xml", "<foo>bar</foo>"],
            ["html", "html", "<p>bar</p>"],
            ["sparql", "sparql", "SELECT ?s WHERE { ?s ?p ?o }"],
        ])(
            "highlights the data of bodies with type '%s' as %s",
            async (type, language, data) => {
                await expectLanguages([
                    ["yaml", "http:"],
                    ["yaml", "  method: POST"],
                    ["yaml", "  body:"],
                    ["yaml", `    type: ${type}`],
                    ["yaml", "    data: |-"],
                    [language, `      ${data}`],
                    [language, `      ${data}`],
                    ["yaml", "  auth: inherit"],
                ]);
            },
        );

        it.each(["websocket", "examples"])(
            "highlights bodies in the '%s' section",
            async (section) => {
                await expectLanguages([
                    ["yaml", `${section}:`],
                    ["yaml", "  - name: example"],
                    ["yaml", "    body:"],
                    ["yaml", "      type: json"],
                    ["yaml", "      data: |"],
                    ["json", "        {}"],
                ]);
            },
        );

        it("tokenizes sibling fields of the 'type' field as yaml", async () => {
            await expectLanguages([
                ["yaml", "examples:"],
                ["yaml", "  - response:"],
                ["yaml", "      body:"],
                ["yaml", "        type: json"],
                ["yaml", "        other: value"],
                ["yaml", "        data: |2-"],
                ["json", '            "unclosed'],
                ["yaml", "        other2: value"],
            ]);
        });

        it("does not guess the language of bodies with type 'text'", async () => {
            await expectLanguages([
                ["yaml", "http:"],
                ["yaml", "  body:"],
                ["yaml", "    type: text"],
                ["yaml", "    data: |"],
                ["yaml", "      { not json }"],
            ]);
        });

        it.each([
            ["json", "{"],
            ["json", "["],
            ["html", "<!DOCTYPE html>"],
            ["html", "<html>"],
            ["xml", '<?xml version="1.0"?>'],
            ["sparql", "PREFIX foaf: <http://xmlns.com/foaf/0.1/>"],
            ["yaml", "plain text"],
        ])(
            "guesses the language %s for data starting with '%s' if the 'type' field is defined after it",
            async (language, firstLine) => {
                await expectLanguages([
                    ["yaml", "http:"],
                    ["yaml", "  body:"],
                    ["yaml", "    data: |"],
                    ["", ""],
                    [language, `      ${firstLine}`],
                    [language, "      {"],
                    ["yaml", "    type: something"],
                ]);
            },
        );

        it("highlights GraphQL queries and variables", async () => {
            await expectLanguages([
                ["yaml", "graphql:"],
                ["yaml", "  body:"],
                ["yaml", "    query: |-"],
                ["graphql", "      query { foo }"],
                ["yaml", "    variables: |-"],
                ["json", '      { "a": 1 }'],
            ]);
        });

        it("highlights gRPC messages as JSON", async () => {
            await expectLanguages([
                ["yaml", "grpc:"],
                ["yaml", "  message: |"],
                ["json", '    { "a": 1 }'],
                ["yaml", "  other:"],
                ["yaml", "    - name: m"],
                ["yaml", "      message: |"],
                ["json", '        { "a": 1 }'],
            ]);
        });

        it("highlights variable references in JSON bodies", async () => {
            const tokens = await tokenizeYaml(
                [
                    "http:",
                    "  body:",
                    "    type: json",
                    "    data: |",
                    '      { "a": {{myVar}} }',
                ].join("\n"),
            );

            expect(
                tokens[4].find(({ text }) => text == "{{myVar}}")?.scopes,
            ).toContain("variable.language");
        });

        it("does not highlight bodies outside of known sections", async () => {
            await expectLanguages([
                ["yaml", "something:"],
                ["yaml", "  body:"],
                ["yaml", "    type: json"],
                ["yaml", "    data: |"],
                ["yaml", "      {}"],
            ]);
        });
    });

    describe("docs", () => {
        it("highlights top-level docs as Markdown", async () => {
            await expectLanguages([
                ["yaml", "docs: |"],
                ["markdown", "  # Heading"],
                ["markdown", "  text"],
                ["yaml", "settings:"],
            ]);
        });

        it("highlights the content of docs sections as Markdown", async () => {
            await expectLanguages([
                ["yaml", "docs:"],
                ["yaml", "  content: |-"],
                ["markdown", "    # Heading"],
                ["yaml", "  type: text/markdown"],
            ]);
        });
    });

    describe("app code", () => {
        it("highlights the top-level code of app files as HTML", async () => {
            await expectLanguages([
                ["yaml", "info:"],
                ["yaml", "  type: app"],
                ["yaml", "code: |"],
                ["html", '  <div class="a">'],
            ]);
        });

        it("highlights the code in the 'app' section of request files as HTML", async () => {
            await expectLanguages([
                ["yaml", "app:"],
                ["yaml", "  code: |"],
                ["html", '    <div class="a">'],
                ["yaml", "  other: value"],
            ]);
        });
    });

    it("uses stub grammars that tokenize strings", async () => {
        const tokens = await tokenizeYaml(
            ["grpc:", "  message: |", '    "a"'].join("\n"),
        );

        expect(tokens[2][0].scopes).toContain(stubStringScope);
    });
});

/**
 * Checks the language of the tokens in each line.
 * @param lines The expected language (as returned by {@link getLanguagesPerLine}) and the content of each line.
 */
async function expectLanguages(lines: [string, string][]) {
    const content = lines.map(([, line]) => line).join("\n");

    expect(await getLanguagesPerLine(content)).toEqual(
        lines.map(([language]) => language),
    );
}
