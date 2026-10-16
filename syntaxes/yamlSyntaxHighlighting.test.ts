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
                await expectLanguagesInBrunoFile([
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
            await expectLanguagesInBrunoFile([
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
            await expectLanguagesInBrunoFile([
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
                await expectLanguagesInBrunoFile([
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
                await expectLanguagesInBrunoFile([
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
            await expectLanguagesInBrunoFile([
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
            await expectLanguagesInBrunoFile([
                ["yaml", "http:"],
                ["yaml", "  body:"],
                ["yaml", "    type: text"],
                ["yaml", "    data: |"],
                ["yaml", "      { not json }"],
            ]);
        });

        it.each(['"text"', "'text'", "text # comment"])(
            "recognizes the body type %s",
            async (typeLine) => {
                await expectLanguagesInBrunoFile([
                    ["yaml", "http:"],
                    ["yaml", "  body:"],
                    ["yaml", `    type: ${typeLine}`],
                    ["yaml", "    data: |"],
                    ["yaml", "      { not json }"],
                ]);
            },
        );

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
                await expectLanguagesInBrunoFile([
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
            await expectLanguagesInBrunoFile([
                ["yaml", "graphql:"],
                ["yaml", "  body:"],
                ["yaml", "    query: |-"],
                ["graphql", "      query { foo }"],
                ["yaml", "    variables: |-"],
                ["json", '      { "a": 1 }'],
            ]);
        });

        it("highlights gRPC messages as JSON", async () => {
            await expectLanguagesInBrunoFile([
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
                    ...brunoFileHeader,
                    "http:",
                    "  body:",
                    "    type: json",
                    "    data: |",
                    '      { "a": {{myVar}} }',
                ].join("\n"),
            );

            expect(
                tokens[brunoFileHeader.length + 4].find(
                    ({ text }) => text == "{{myVar}}",
                )?.scopes,
            ).toContain("variable.language");
        });

        it("does not highlight bodies outside of known sections", async () => {
            await expectLanguagesInBrunoFile([
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
            await expectLanguagesInBrunoFile([
                ["yaml", "docs: |"],
                ["markdown", "  # Heading"],
                ["markdown", "  text"],
                ["yaml", "settings:"],
            ]);
        });

        it("highlights the content of docs sections as Markdown", async () => {
            await expectLanguagesInBrunoFile([
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
            await expectLanguagesInBrunoFile([
                ["yaml", "app:"],
                ["yaml", "  code: |"],
                ["html", '    <div class="a">'],
                ["yaml", "  other: value"],
            ]);
        });
    });

    describe("files that are not Bruno files", () => {
        it.each([
            ["a different key", "name: something"],
            ["a comment", "# info:"],
            ["an indented key", "  info:"],
            ["a key starting with 'info'", "information:"],
        ])(
            "does not highlight any sections if the first line is %s",
            async (_, firstLine) => {
                await expectLanguages([
                    ["yaml", firstLine],
                    ["yaml", "docs: |"],
                    ["yaml", "  # Heading"],
                    ["yaml", "code: |"],
                    ["yaml", '  <div class="a">'],
                    ["yaml", "runtime:"],
                    ["yaml", "  scripts:"],
                    ["yaml", "    - type: tests"],
                    ["yaml", "      code: |"],
                    ["yaml", "        test();"],
                    ["yaml", "http:"],
                    ["yaml", "  body:"],
                    ["yaml", "    type: json"],
                    ["yaml", "    data: |"],
                    ["yaml", "      {}"],
                ]);
            },
        );

        it("does not highlight any sections if the 'info' key is not in the first line", async () => {
            await expectLanguages([
                ["yaml", "name: something"],
                ["yaml", "info:"],
                ["yaml", "  type: app"],
                ["yaml", "code: |"],
                ["yaml", '  <div class="a">'],
            ]);
        });
    });

    it("highlights sections in collection files (starting with 'opencollection')", async () => {
        await expectLanguages([
            ["yaml", "opencollection: 1.0.0"],
            ["yaml", "request:"],
            ["yaml", "  scripts:"],
            ["yaml", "    - type: before-request"],
            ["yaml", "      code: |"],
            ["javascript", "        a();"],
            ["yaml", "docs:"],
            ["yaml", "  content: |"],
            ["markdown", "    # Heading"],
        ]);
    });

    it("uses stub grammars that tokenize strings", async () => {
        const tokens = await tokenizeYaml(
            [...brunoFileHeader, "grpc:", "  message: |", '    "a"'].join("\n"),
        );

        expect(tokens[brunoFileHeader.length + 2][0].scopes).toContain(
            stubStringScope,
        );
    });
});

/** The first lines of a Bruno request file (Bruno yaml files are only highlighted if they start with one of the known keys). */
const brunoFileHeader = ["info:", "  type: http"];

/**
 * Like {@link expectLanguages}, but prepends the {@link brunoFileHeader} to the given lines.
 */
async function expectLanguagesInBrunoFile(lines: [string, string][]) {
    await expectLanguages([
        ...brunoFileHeader.map((line): [string, string] => ["yaml", line]),
        ...lines,
    ]);
}

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
