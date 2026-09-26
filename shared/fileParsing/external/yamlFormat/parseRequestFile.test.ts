import { describe, it, expect } from "@jest/globals";
import { TextDocumentHelper } from "../../../fileSystem/textDocumentHelper";
import { Position, Range } from "../../..";
import {
    getExpectedKeyRange,
    getExpectedSameLineValueRange,
} from "../../../_testingUtils";
import {
    RequestFileHttpSectionProperty,
    RequestFileRuntimeProperty,
    TopLevelRequestFileProperty,
} from "./constants/requestFileConstants";
import { parseRequestFile } from "./parseRequestFile";

describe("parseRequestFile", () => {
    describe("valid files", () => {
        it("parses a minimal request file with only info section", () => {
            const documentText = `info:
    name: test request
    type: http
    seq: 1`;

            const { result, errors } = parseRequestFile(
                new TextDocumentHelper(documentText),
            );

            expect(errors).toHaveLength(0);
            expect(result).toBeDefined();
            expect(result!.properties.info).toBeDefined();
            expect(result!.properties.info!.properties.name?.value).toBe(
                "test request",
            );
            expect(result!.properties.http).toBeUndefined();
            expect(result!.properties.runtime).toBeUndefined();
            expect(result!.properties.settings).toBeUndefined();
            expect(result!.properties.docs).toBeUndefined();
            expect(result!.properties.app).toBeUndefined();
        });

        it("parses a request file with info and http sections", () => {
            const documentText = `info:
    name: my request
    type: http
    seq: 2

http:
    method: GET
    url: https://example.com/api`;

            const docHelper = new TextDocumentHelper(documentText);
            const { result, errors } = parseRequestFile(docHelper);

            expect(errors).toHaveLength(0);
            expect(result).toBeDefined();

            expect(result!.properties.info).toBeDefined();
            expect(result!.properties.info!.properties.name?.value).toBe(
                "my request",
            );

            const http = result!.properties.http;
            expect(http).toBeDefined();
            expect(http!.keyRange).toEqual(
                getExpectedKeyRange(5, TopLevelRequestFileProperty.Http, 0),
            );
            expect(http!.properties.method?.value).toBe("GET");
            expect(http!.properties.url?.value).toBe(
                "https://example.com/api",
            );
        });

        it("parses a request file with http section containing headers and params", () => {
            const documentText = `info:
    name: request with headers
    type: http
    seq: 3

http:
    method: POST
    url: https://example.com/api
    headers:
        - name: Content-Type
          value: application/json
          description: content type header
          disabled: false
    params:
        - name: page
          value: "1"
          description: page number
          disabled: false
          type: query`;

            const { result, errors } = parseRequestFile(
                new TextDocumentHelper(documentText),
            );

            expect(errors).toHaveLength(0);
            expect(result).toBeDefined();

            const http = result!.properties.http;
            expect(http).toBeDefined();
            expect(http!.properties.method?.value).toBe("POST");

            const headers = http!.properties.headers;
            expect(headers).toBeDefined();
            expect(headers).toHaveLength(1);
            expect(headers![0].properties.name?.value).toBe("Content-Type");
            expect(headers![0].properties.value?.value).toBe(
                "application/json",
            );

            const params = http!.properties.params;
            expect(params).toBeDefined();
            expect(params).toHaveLength(1);
            expect(params![0].properties.name?.value).toBe("page");
            expect(params![0].properties.value?.value).toBe("1");
        });

        it("parses a request file with auth as scalar (inherit)", () => {
            const documentText = `info:
    name: auth request
    type: http
    seq: 4

http:
    method: GET
    url: https://example.com
    auth: inherit`;

            const { result, errors } = parseRequestFile(
                new TextDocumentHelper(documentText),
            );

            expect(errors).toHaveLength(0);
            expect(result!.properties.http?.properties.auth).toBeDefined();
        });

        it("parses a request file with auth as map (basic)", () => {
            const documentText = `info:
    name: auth request
    type: http
    seq: 5

http:
    method: GET
    url: https://example.com
    auth:
        type: basic
        username: myuser
        password: mypassword`;

            const { result, errors } = parseRequestFile(
                new TextDocumentHelper(documentText),
            );

            expect(errors).toHaveLength(0);
            const auth = result!.properties.http?.properties.auth;
            expect(auth).toBeDefined();
        });

        it("parses a request file with a runtime section", () => {
            const documentText = `info:
    name: runtime request
    type: http
    seq: 6

http:
    method: GET
    url: https://example.com

runtime:
    variables:
        - name: myVar
          value: test
          description: a variable
          disabled: false
    scripts:
        - type: before-request
          code: console.log("before")`;

            const docHelper = new TextDocumentHelper(documentText);
            const { result, errors } = parseRequestFile(docHelper);

            expect(errors).toHaveLength(0);
            expect(result).toBeDefined();

            const runtime = result!.properties.runtime;
            expect(runtime).toBeDefined();
            expect(runtime!.keyRange).toEqual(
                getExpectedKeyRange(
                    9,
                    TopLevelRequestFileProperty.Runtime,
                    0,
                ),
            );

            const variables = runtime!.properties.variables;
            expect(variables).toBeDefined();
            expect(variables!.enabled).toHaveLength(1);
            expect(variables!.enabled[0].properties.name?.value).toBe("myVar");

            const scripts = runtime!.properties.scripts;
            expect(scripts).toBeDefined();
            expect(scripts).toHaveLength(1);
            expect(scripts![0].properties.type?.value).toBe("before-request");
        });

        it("parses a request file with a docs scalar", () => {
            const documentText = `info:
    name: documented request
    type: http
    seq: 7

docs: some documentation text`;

            const docHelper = new TextDocumentHelper(documentText);
            const { result, errors } = parseRequestFile(docHelper);

            expect(errors).toHaveLength(0);
            expect(result).toBeDefined();

            const docs = result!.properties.docs;
            expect(docs).toBeDefined();
            expect(docs!.value).toBe("some documentation text");
            expect(docs!.keyRange).toEqual(
                getExpectedKeyRange(5, TopLevelRequestFileProperty.Docs, 0),
            );
            expect(docs!.valueRange).toEqual(
                getExpectedSameLineValueRange(
                    5,
                    TopLevelRequestFileProperty.Docs,
                    "some documentation text",
                    0,
                ),
            );
        });

        it("parses a request file with a settings section", () => {
            const documentText = `info:
    name: settings request
    type: http
    seq: 8

settings:
    encodeUrl: true
    followRedirects: true`;

            const { result, errors } = parseRequestFile(
                new TextDocumentHelper(documentText),
            );

            expect(errors).toHaveLength(0);
            expect(result).toBeDefined();
            expect(result!.properties.settings).toBeDefined();
        });

        it("parses a request file with all top-level sections", () => {
            const documentText = `info:
    name: full request
    type: http
    seq: 9

http:
    method: POST
    url: https://example.com/api
    headers:
        - name: Accept
          value: application/json
          disabled: false
    auth: inherit

runtime:
    variables:
        - name: responseId
          value: ""
          disabled: false
    assertions:
        - expression: res.status
          operator: eq
          value: "200"

settings:
    encodeUrl: true

docs: request docs`;

            const { result, errors } = parseRequestFile(
                new TextDocumentHelper(documentText),
            );

            expect(errors).toHaveLength(0);
            expect(result).toBeDefined();
            // Only optional sections (graphql, grpc, websocket, examples, app) should be missing.
            expect(
                result!.missingProperties.every(({ isMandatory }) => !isMandatory),
            ).toBeTruthy();

            expect(result!.properties.info).toBeDefined();
            expect(result!.properties.http).toBeDefined();
            expect(result!.properties.runtime).toBeDefined();
            expect(result!.properties.settings).toBeDefined();
            expect(result!.properties.docs).toBeDefined();
        });
    });

    describe("error handling", () => {
        it("returns an error when info section is missing", () => {
            const documentText = `http:
    method: GET
    url: https://example.com`;

            const { result, errors } = parseRequestFile(
                new TextDocumentHelper(documentText),
            );

            expect(errors).toHaveLength(1);
            expect(result).toBeDefined();
            expect(result!.missingProperties).toContainEqual(
                expect.objectContaining({
                    key: TopLevelRequestFileProperty.Info,
                    isMandatory: true,
                }),
            );
        });

        it("returns an error for an unknown top-level key", () => {
            const documentText = `info:
    name: test
    type: http
    seq: 1

unknownKey: someValue`;

            const { result, errors } = parseRequestFile(
                new TextDocumentHelper(documentText),
            );

            expect(errors).toHaveLength(1);
            expect(errors[0].range).toEqual(
                getExpectedKeyRange(5, "unknownKey", 0),
            );
            expect(result).toBeDefined();
            expect(result!.properties.info).toBeDefined();
        });

        it("returns errors for unknown keys in http section", () => {
            const documentText = `info:
    name: test
    type: http
    seq: 1

http:
    method: GET
    url: https://example.com
    unknownHttpKey: value`;

            const { result, errors } = parseRequestFile(
                new TextDocumentHelper(documentText),
            );

            expect(errors).toHaveLength(1);
            expect(
                errors.some(({ range }) =>
                    range.equals(
                        getExpectedKeyRange(8, "unknownHttpKey", 4),
                    ),
                ),
            ).toBeTruthy();
            expect(result!.properties.http).toBeDefined();
            expect(result!.properties.http!.properties.method?.value).toBe(
                "GET",
            );
        });

        it("returns errors for unknown keys in runtime section", () => {
            const documentText = `info:
    name: test
    type: http
    seq: 1

runtime:
    unknownRuntimeKey:
        - something`;

            const { errors } = parseRequestFile(
                new TextDocumentHelper(documentText),
            );

            expect(errors).toHaveLength(1);
            expect(
                errors.some(({ range }) =>
                    range.equals(
                        getExpectedKeyRange(6, "unknownRuntimeKey", 4),
                    ),
                ),
            ).toBeTruthy();
        });

        it("tracks missing properties for http section keys that are absent", () => {
            const documentText = `info:
    name: test
    type: http
    seq: 1

http:
    method: GET`;

            const { result, errors } = parseRequestFile(
                new TextDocumentHelper(documentText),
            );

            expect(errors).toHaveLength(0);
            const http = result!.properties.http;
            expect(http).toBeDefined();
            expect(http!.missingProperties).toContainEqual(
                expect.objectContaining({
                    key: RequestFileHttpSectionProperty.url,
                    alwaysHasScalarValue: true,
                }),
            );
        });

        it("tracks missing properties for runtime section keys that are absent", () => {
            const documentText = `info:
    name: test
    type: http
    seq: 1

runtime:
    scripts:
        - type: before-request
          code: console.log("hi")`;

            const { result, errors } = parseRequestFile(
                new TextDocumentHelper(documentText),
            );

            expect(errors).toHaveLength(0);
            const runtime = result!.properties.runtime;
            expect(runtime).toBeDefined();
            expect(runtime!.missingProperties).toContainEqual(
                expect.objectContaining({
                    key: RequestFileRuntimeProperty.Variables,
                    isMandatory: false,
                }),
            );
        });

        it("returns multiple errors for multiple problems", () => {
            const documentText = `info:
    name: test
    unknownInfoKey: value
    type: http
    seq: 1

http:
    method: GET
    unknownHttpKey: value`;

            const { result, errors } = parseRequestFile(
                new TextDocumentHelper(documentText),
            );

            expect(errors.length).toBeGreaterThanOrEqual(2);
            expect(result).toBeDefined();
        });
    });

    describe("key and value ranges", () => {
        it("returns correct keyRange and valueRange for the http section", () => {
            const documentText = `info:
    name: test
    type: http
    seq: 1

http:
    method: GET
    url: https://example.com`;

            const docHelper = new TextDocumentHelper(documentText);
            const { result } = parseRequestFile(docHelper);

            const http = result!.properties.http;
            expect(http).toBeDefined();
            expect(http!.keyRange).toEqual(
                getExpectedKeyRange(5, TopLevelRequestFileProperty.Http, 0),
            );
            expect(http!.valueRange).toEqual(
                new Range(new Position(6, 4), docHelper.getTextRange()!.end),
            );
        });

        it("returns correct keyRange and valueRange for the runtime section", () => {
            const documentText = `info:
    name: test
    type: http
    seq: 1

runtime:
    variables:
        - name: x
          value: y
          disabled: false
          type: string`;

            const docHelper = new TextDocumentHelper(documentText);
            const { result } = parseRequestFile(docHelper);

            const runtime = result!.properties.runtime;
            expect(runtime).toBeDefined();
            expect(runtime!.keyRange).toEqual(
                getExpectedKeyRange(
                    5,
                    TopLevelRequestFileProperty.Runtime,
                    0,
                ),
            );
            expect(runtime!.valueRange).toEqual(
                new Range(
                    new Position(6, 4),
                    docHelper.getTextRange()!.end,
                ),
            );
        });
    });
});
