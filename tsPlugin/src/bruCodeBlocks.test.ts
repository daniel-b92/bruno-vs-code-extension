import { describe, it, expect } from "@jest/globals";
import * as ts from "typescript/lib/tsserverlibrary";
import {
    createLanguageServiceWithPlugin,
    getCompletionNames,
    getDiagnosticTexts,
} from "./_testingUtils";
import { redeclaredRuntimeObjectDiagnosticCode } from "./diagnostics/getDiagnosticsForRedeclaredRuntimeObjects";

describe("handling of code blocks in bru files", () => {
    const collectionFiles = {
        "/collection/bruno.json": '{ "type": "collection" }',
    };
    const requestFile = "/collection/request.bru";
    const requestBlocks = `meta {
  name: request
  type: http
  seq: 1
}

get {
  url: https://example.com/api/users/1
  body: none
  auth: none
}

headers {
  Content-Type: application/json
}
`;

    it("does not report syntax errors for the content outside of code blocks", () => {
        const languageService = createLanguageServiceWithPlugin({
            ...collectionFiles,
            [requestFile]: `${requestBlocks}
docs {
  This is not code: {
}
`,
        });

        expect(languageService.getSyntacticDiagnostics(requestFile)).toEqual(
            [],
        );
        expect(languageService.getSemanticDiagnostics(requestFile)).toEqual([]);
    });

    it("reports diagnostics at the positions within the original file", () => {
        const content = `${requestBlocks}
script:pre-request {
  const a = 1;
  valeu;
}
`;

        expect(
            getDiagnosticTexts(
                createLanguageServiceWithPlugin({
                    ...collectionFiles,
                    [requestFile]: content,
                }),
                requestFile,
                content,
            ),
        ).toEqual([{ code: 2_304, text: "valeu" }]);
    });

    it("allows top-level `await` and `return` in code blocks", () => {
        const content = `${requestBlocks}
script:pre-request {
  await bru.sleep(1);
  return;
}

tests {
  await bru.sleep(1);
  return;
}
`;

        expect(
            getDiagnosticTexts(
                createLanguageServiceWithPlugin({
                    ...collectionFiles,
                    [requestFile]: content,
                }),
                requestFile,
                content,
            ),
        ).toEqual([]);
    });

    it("still reports `await` within non-async functions", () => {
        const content = `${requestBlocks}
script:pre-request {
  function sleep() {
    await bru.sleep(1);
  }
}
`;

        expect(
            getDiagnosticTexts(
                createLanguageServiceWithPlugin({
                    ...collectionFiles,
                    [requestFile]: content,
                }),
                requestFile,
                content,
            ),
        ).toEqual([{ code: 1_308, text: "await" }]);
    });

    it("scopes the declarations of each code block separately", () => {
        const content = `${requestBlocks}
script:pre-request {
  const a = 1;
  var b = 1;
}

script:post-response {
  const a = 2;
  var b = 2;
}

tests {
  const a = 3;
  var b = 3;
}
`;

        expect(
            getDiagnosticTexts(
                createLanguageServiceWithPlugin({
                    ...collectionFiles,
                    [requestFile]: content,
                }),
                requestFile,
                content,
            ),
        ).toEqual([]);
    });

    it("reports the usage of `res` in a pre-request block, but not the usage of `req` in any block", () => {
        const content = `${requestBlocks}
script:pre-request {
  res.status;
  req.getUrl();
}

assert {
  res.status: eq 200
  res.body.message: isString
}

script:post-response {
  req.getUrl();
  res.status;
}
`;

        expect(
            getDiagnosticTexts(
                createLanguageServiceWithPlugin({
                    ...collectionFiles,
                    [requestFile]: content,
                }),
                requestFile,
                content,
            ),
        ).toEqual([
            // 'res' is possibly 'undefined'.
            { code: 18_048, text: "res" },
        ]);
    });

    it("only provides the parts of `bru.grpc` that are available in a code block of a gRPC request", () => {
        const content = `meta {
  name: request
  type: grpc
  seq: 1
}

grpc {
  url: localhost:50051
  method: /example.Greeter/SayHello
  methodType: unary
}

script:grpc:before-call-start {
  bru.grpc.request.url;
  bru.grpc.response.statusCode;
}

script:grpc:after-call-end {
  bru.grpc.response.statusCode;
  bru.grpc.request.url;
}
`;

        expect(
            getDiagnosticTexts(
                createLanguageServiceWithPlugin({
                    ...collectionFiles,
                    [requestFile]: content,
                }),
                requestFile,
                content,
            ),
        ).toEqual([
            // Property 'response' does not exist on type '{ request: ... }'.
            { code: 2_339, text: "response" },
            { code: 2_339, text: "request" },
        ]);
    });

    it("shadows the unavailable objects for a code block that directly follows another code block", () => {
        const content = `script:post-response {
  req.getUrl();
}

script:pre-request {
  req.getUrl();
  res.status;
}
`;

        expect(
            getDiagnosticTexts(
                createLanguageServiceWithPlugin({
                    ...collectionFiles,
                    [requestFile]: content,
                }),
                requestFile,
                content,
            ),
        ).toEqual([{ code: 18_048, text: "res" }]);
    });

    it("allows top-level `await` in a `tests` block that only has little space in front of it", () => {
        const content = `script:pre-request {
  const a = 1;
}

tests {
  const status = await Promise.resolve(res.status);
  for await (const value of [status]) {
    status + value;
  }
}
`;

        expect(
            getDiagnosticTexts(
                createLanguageServiceWithPlugin({
                    ...collectionFiles,
                    [requestFile]: content,
                }),
                requestFile,
                content,
            ),
        ).toEqual([]);
    });

    it("still reports `await` within non-async functions of a `tests` block that only has little space in front of it", () => {
        const content = `script:pre-request {
  const a = 1;
}

tests {
  function sleep() {
    await Promise.resolve();
  }
  const values = [1].map((value) => {
    for await (const other of [value]) {
      other;
    }
  });
}
`;

        expect(
            getDiagnosticTexts(
                createLanguageServiceWithPlugin({
                    ...collectionFiles,
                    [requestFile]: content,
                }),
                requestFile,
                content,
            ),
        ).toEqual([
            { code: 1_308, text: "await" },
            { code: 1_103, text: "await" },
        ]);
    });

    it.each([
        { declaration: "const res = 1;", usage: "res.toFixed();" },
        { declaration: "let res = 1;", usage: "res.toFixed();" },
        { declaration: "var res = 1;", usage: "res.toFixed();" },
        { declaration: "function res() {}", usage: "res();" },
        { declaration: "class res {}", usage: "new res();" },
        { declaration: "const { res } = { res: 1 };", usage: "res.toFixed();" },
        { declaration: "const [, res] = [0, 1];", usage: "res.toFixed();" },
        {
            declaration: "if (true) { var res = 1; }",
            usage: "res.toFixed();",
        },
    ])(
        "only shows a warning for redeclaring `res` in a pre-request block with '$declaration'",
        ({ declaration, usage }) => {
            const content = `${requestBlocks}
script:pre-request {
  ${declaration}
  ${usage}
}
`;

            expect(
                getDiagnosticTexts(
                    createLanguageServiceWithPlugin({
                        ...collectionFiles,
                        [requestFile]: content,
                    }),
                    requestFile,
                    content,
                ),
            ).toEqual([
                { code: redeclaredRuntimeObjectDiagnosticCode, text: "res" },
            ]);
        },
    );

    it("shows warnings for redeclaring `bru`, `req` and `res` in any code block", () => {
        const content = `${requestBlocks}
script:post-response {
  const res = 1;
  const { req } = { req: 1 };
}

tests {
  var bru = 1;
}
`;
        const languageService = createLanguageServiceWithPlugin({
            ...collectionFiles,
            [requestFile]: content,
        });

        expect(
            getDiagnosticTexts(languageService, requestFile, content),
        ).toEqual([
            { code: redeclaredRuntimeObjectDiagnosticCode, text: "res" },
            { code: redeclaredRuntimeObjectDiagnosticCode, text: "req" },
            { code: redeclaredRuntimeObjectDiagnosticCode, text: "bru" },
        ]);
        expect(
            languageService
                .getSemanticDiagnostics(requestFile)
                .map(({ category }) => category),
        ).toEqual([
            ts.DiagnosticCategory.Warning,
            ts.DiagnosticCategory.Warning,
            ts.DiagnosticCategory.Warning,
        ]);
    });

    it("does not show a warning for declarations of `res` in nested functions or blocks of a pre-request block", () => {
        const content = `${requestBlocks}
script:pre-request {
  function getStatus() {
    var res = { status: 200 };
    return res.status;
  }
  {
    const res = 1;
  }
  res.status;
}
`;

        expect(
            getDiagnosticTexts(
                createLanguageServiceWithPlugin({
                    ...collectionFiles,
                    [requestFile]: content,
                }),
                requestFile,
                content,
            ),
        ).toEqual([
            // 'res' is possibly 'undefined'.
            { code: 18_048, text: "res" },
        ]);
    });

    it("only shows a warning for redeclaring `bru` in a code block of a gRPC request", () => {
        const content = `meta {
  name: request
  type: grpc
  seq: 1
}

script:grpc:before-call-start {
  const bru = { value: 1 };
  bru.value;
}

script:grpc:after-call-end {
  bru.grpc.response.statusCode;
}
`;

        expect(
            getDiagnosticTexts(
                createLanguageServiceWithPlugin({
                    ...collectionFiles,
                    [requestFile]: content,
                }),
                requestFile,
                content,
            ),
        ).toEqual([
            { code: redeclaredRuntimeObjectDiagnosticCode, text: "bru" },
        ]);
    });

    it("does not leak `var` declarations of a `tests` block into other files", () => {
        const otherFile = "/collection/other.bru";
        const content = `script:pre-request {
  const a = 1;
}

tests {
  var count = res.status;
}
`;
        const otherContent = `script:pre-request {
  const a = 1;
}

tests {
  var count = "none";
}
`;
        const languageService = createLanguageServiceWithPlugin({
            ...collectionFiles,
            [requestFile]: content,
            [otherFile]: otherContent,
        });

        expect(
            getDiagnosticTexts(languageService, requestFile, content),
        ).toEqual([]);
        expect(
            getDiagnosticTexts(languageService, otherFile, otherContent),
        ).toEqual([]);
    });

    it("does not suggest the variables that are used for wrapping code blocks", () => {
        const content = "script:pre-request {\n  \n}\n";
        const languageService = createLanguageServiceWithPlugin({
            ...collectionFiles,
            [requestFile]: content,
        });

        const names = getCompletionNames(
            languageService,
            requestFile,
            content.indexOf("\n}") - 1,
        );

        expect(names).toContain("bru");
        expect(names.filter((name) => name.startsWith("$"))).toEqual([]);
    });

    it("does not provide formatting edits", () => {
        const requestFileContent = `${requestBlocks}
script:pre-request {
const a   = 1;
}
`;
        const languageService = createLanguageServiceWithPlugin({
            ...collectionFiles,
            [requestFile]: requestFileContent,
        });

        expect(
            languageService.getFormattingEditsForDocument(
                requestFile,
                ts.getDefaultFormatCodeSettings(),
            ),
        ).toEqual([]);
    });
});
