import { describe, it, expect } from "@jest/globals";
import {
    BrunoFileType,
    CollectionFormat,
    ItemType,
    NonBrunoSpecificItemType,
    Position,
    Range,
} from "../../../..";
import { getRunRequestPathLiterals } from "./getRunRequestPathLiterals";

describe("getRunRequestPathLiterals", () => {
    describe("Bru files", () => {
        it.each([
            ["script:pre-request", "script:pre-request"],
            ["script:post-response", "script:post-response"],
            ["tests", "tests"],
        ])("finds the path in a %s block of a request file", (_, blockName) => {
            const content = `meta {
  name: a
}

${blockName} {
  await bru.runRequest("users/get-user");
}
`;

            expect(
                getRunRequestPathLiterals(
                    content,
                    BrunoFileType.RequestFile,
                    CollectionFormat.Bru,
                ),
            ).toEqual([
                {
                    path: "users/get-user",
                    range: new Range(new Position(5, 24), new Position(5, 38)),
                    quote: '"',
                    isInSingleLinePlainScalar: false,
                },
            ]);
        });

        it.each([
            [BrunoFileType.FolderSettingsFile],
            [BrunoFileType.CollectionSettingsFile],
        ])("finds the path in a settings file of type %s", (itemType) => {
            const content = `script:pre-request {
  bru.runRequest('a/b');
}
`;

            const result = getRunRequestPathLiterals(
                content,
                itemType,
                CollectionFormat.Bru,
            );

            expect(result.map(({ path, quote }) => [path, quote])).toEqual([
                ["a/b", "'"],
            ]);
        });
    });

    describe("Yaml files", () => {
        it("finds the path in a literal block scalar", () => {
            const content = `info:
  name: a
  type: http
runtime:
  scripts:
    - type: before-request
      code: |-
        await bru.runRequest("users/get-user");
`;

            expect(
                getRunRequestPathLiterals(
                    content,
                    BrunoFileType.RequestFile,
                    CollectionFormat.Yaml,
                ),
            ).toEqual([
                {
                    path: "users/get-user",
                    range: new Range(new Position(7, 30), new Position(7, 44)),
                    quote: '"',
                    isInSingleLinePlainScalar: false,
                },
            ]);
        });

        it("finds the path in a single-line plain scalar and returns the correct range", () => {
            const content = `info:
  name: a
  type: http
runtime:
  scripts:
    - type: before-request
      code: bru.runRequest('users/get-user');
`;

            expect(
                getRunRequestPathLiterals(
                    content,
                    BrunoFileType.RequestFile,
                    CollectionFormat.Yaml,
                ),
            ).toEqual([
                {
                    path: "users/get-user",
                    range: new Range(new Position(6, 28), new Position(6, 42)),
                    quote: "'",
                    isInSingleLinePlainScalar: true,
                },
            ]);
        });

        it("ignores scripts in quoted scalars", () => {
            const content = `info:
  name: a
  type: http
runtime:
  scripts:
    - type: before-request
      code: "bru.runRequest('users/get-user');"
`;

            expect(
                getRunRequestPathLiterals(
                    content,
                    BrunoFileType.RequestFile,
                    CollectionFormat.Yaml,
                ),
            ).toEqual([]);
        });

        it("finds the path in the scripts of a collection settings file", () => {
            const content = `request:
  scripts:
    - type: before-request
      code: |-
        bru.runRequest("a");
`;

            expect(
                getRunRequestPathLiterals(
                    content,
                    BrunoFileType.CollectionSettingsFile,
                    CollectionFormat.Yaml,
                ).map(({ path }) => path),
            ).toEqual(["a"]);
        });
    });

    describe("other files", () => {
        it("searches the whole content of JS files", () => {
            const content = `module.exports = async () => {
    await bru.runRequest("a/b");
};
`;

            expect(
                getRunRequestPathLiterals(
                    content,
                    NonBrunoSpecificItemType.OtherFileType,
                    CollectionFormat.Bru,
                ),
            ).toEqual([
                {
                    path: "a/b",
                    range: new Range(new Position(1, 26), new Position(1, 29)),
                    quote: '"',
                    isInSingleLinePlainScalar: false,
                },
            ]);
        });

        it.each([[BrunoFileType.EnvironmentFile], [BrunoFileType.AppFile]])(
            "ignores files of type %s",
            (itemType) => {
                expect(
                    getRunRequestPathLiterals(
                        'bru.runRequest("a")',
                        itemType,
                        CollectionFormat.Bru,
                    ),
                ).toEqual([]);
            },
        );
    });

    describe("matching rules", () => {
        it.each([
            ["optional chaining", 'bru?.runRequest("a")', "a", '"'],
            ["a template literal", "bru.runRequest(`a/b`)", "a/b", "`"],
            ["further arguments", 'bru.runRequest("a", {x: 1})', "a", '"'],
            [
                "whitespace and comments",
                'bru /* c */ . runRequest (\n "a")',
                "a",
                '"',
            ],
        ])("finds a path with %s", (_, code, expectedPath, expectedQuote) => {
            const result = getPathsFromJsContent(code);

            expect(result.map(({ path, quote }) => [path, quote])).toEqual([
                [expectedPath, expectedQuote],
            ]);
        });

        it.each([
            ["a variable", "bru.runRequest(path)"],
            [
                "a template literal with substitutions",
                "bru.runRequest(`${a}/b`)",
            ],
            ["no argument", "bru.runRequest()"],
            ["a property of another object", 'foo.bru.runRequest("a")'],
            ["another function", 'bru.runRequests("a")'],
            ["another object", 'req.runRequest("a")'],
            ["escapes in the literal", 'bru.runRequest("a\\"b")'],
        ])("does not find a path for %s", (_, code) => {
            expect(getPathsFromJsContent(code)).toEqual([]);
        });

        it("finds multiple calls", () => {
            const result = getPathsFromJsContent(
                'bru.runRequest("a");\nbru.runRequest("b/c");',
            );

            expect(result.map(({ path }) => path)).toEqual(["a", "b/c"]);
            expect(result[1].range).toEqual(
                new Range(new Position(1, 16), new Position(1, 19)),
            );
        });
    });
});

function getPathsFromJsContent(content: string) {
    return getRunRequestPathLiterals(
        content,
        NonBrunoSpecificItemType.OtherFileType satisfies ItemType,
        CollectionFormat.Bru,
    );
}
