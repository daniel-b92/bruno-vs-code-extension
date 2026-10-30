import { describe, it, expect } from "@jest/globals";
import {
    createLanguageServiceWithPlugin,
    getDiagnosticTexts,
} from "./_testingUtils";
import { redeclaredRuntimeObjectDiagnosticCode } from "./diagnostics/getDiagnosticsForRedeclaredRuntimeObjects";

describe("handling of scripts in Yaml files", () => {
    const collectionFiles = {
        "/collection/opencollection.yml": "opencollection: 1.0.0\n",
    };
    const requestFile = "/collection/request.yml";

    it.each([
        {
            scriptType: "before-request",
            usedObject: "res",
            code: "res.status;",
        },
    ])(
        "reports the usage of `$usedObject` in a script of type '$scriptType'",
        ({ scriptType, usedObject, code }) => {
            const content = `info:
  name: request
runtime:
  scripts:
    - type: ${scriptType}
      code: |-
        ${code}
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
                // '$usedObject' is possibly 'undefined'.
                { code: 18_048, text: usedObject },
            ]);
        },
    );

    it("scopes the declarations of each script separately and allows top-level `await` and `return`", () => {
        const content = `info:
  name: request
runtime:
  scripts:
    - type: before-request
      code: |-
        var token = bru.getEnvVar("token");
        await bru.sleep(1);
        return;
    - type: tests
      code: |-
        var token = 42;
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

    it("only shows a warning for redeclaring `res` in a script of type 'before-request'", () => {
        const content = `info:
  name: request
runtime:
  scripts:
    - type: before-request
      code: |-
        const res = 1;
        res.toFixed();
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
    });

    it("only provides the parts of `bru.grpc` that are available in a script of a gRPC request", () => {
        const content = `info:
  name: request
  type: grpc
grpc:
  url: localhost:50051
  method: /example.Greeter/SayHello
runtime:
  scripts:
    - type: before-request
      code: |-
        bru.grpc.request.url;
        bru.grpc.response.statusCode;
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
        ]);
    });
});
