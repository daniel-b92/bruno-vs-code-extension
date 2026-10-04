import { describe, it, expect } from "@jest/globals";
import { TextDocumentHelper } from "../../../fileSystem/textDocumentHelper";
import { parseCollectionSettingsFile } from "../../..";
import { YamlParsingErrorCode } from "./interfaces";

describe("parseCollectionSettingsFile", () => {
    it("parses file with all optional sections defined", () => {
        const documentText = `opencollection: 1.0.0

info:
  name: Yaml_example
config:
  protobuf:
    protoFiles:
      - type: file
        path: ./nonexistent-7f3a/schema-q81.proto
    importPaths:
      - path: ./nonexistent-b5d0/imports
  proxy:
    inherit: false
    config:
      protocol: socks5
      hostname: asd
      port: 33
      auth:
        username: asdsd
        password: asdasd
        disabled: true
      bypassProxy: asdasd
    disabled: true
  clientCertificates:
    - domain: adadasd
      type: pem
      certificateFilePath: ./nonexistent-c92e/client-x4k.pem
      privateKeyFilePath: ./nonexistent-c92e/client-key-m2z.pem
      passphrase: asdasdasd
      disabled: true

request:
  headers:
    - name: yxcy
      value: yxcyxc
      description: yxcyxc
  auth:
    type: basic
    username: asd
    password: 3434tf
  variables:
    - name: asdasd
      value:
        type: number
        data: "4545"
      description: asdasd
    - name: asdaasa
      value: adsasd
      description: asdasd
  actions:
    - type: set-variable
      phase: after-response
      selector:
        expression: dsasdasd
        method: jsonq
      variable:
        name: asdasd
        scope: runtime
      description: asdasd
  scripts:
    - type: before-request
      code: aasdas
    - type: after-response
      code: asdcasds
    - type: tests
      code: asdasd
bundled: false
extensions:
  bruno:
    ignore:
      - node_modules
      - .git
    presets:
      request:
        type: http
        url: asdasdas
      defaultEnvironment: Env1
    scripts:
      additionalContextRoots:
        - "./path/to/shared/scripts"
docs:
  content: some docs
  type: text/markdown`;

        const { result, errors } = parseCollectionSettingsFile(
            new TextDocumentHelper(documentText),
        );

        expect(errors).toHaveLength(0);
        expect(result!.missingProperties).toHaveLength(0);
        const { properties } = result!;

        expect(properties.opencollection?.value).toBe("1.0.0");
        expect(properties.info?.properties.name?.value).toBe("Yaml_example");
        expect(properties.bundled?.value).toBe(false);
        expect(properties.docs?.value).toEqual(
            expect.objectContaining({
                properties: expect.objectContaining({
                    content: expect.objectContaining({ value: "some docs" }),
                }),
            }),
        );

        const { protobuf, proxy, clientCertificates } =
            properties.config!.properties;
        expect(protobuf?.properties.protoFiles).toHaveLength(1);
        expect(
            protobuf?.properties.protoFiles?.[0].properties.type?.value,
        ).toBe("file");
        expect(protobuf?.properties.importPaths).toHaveLength(1);
        expect(proxy?.properties.inherit?.value).toBe(false);
        expect(proxy?.properties.disabled?.value).toBe(true);
        const proxyConfig = proxy?.properties.config?.properties;
        expect(proxyConfig?.protocol?.value).toBe("socks5");
        expect(proxyConfig?.hostname?.value).toBe("asd");
        expect(proxyConfig?.port?.value).toBe(33);
        expect(proxyConfig?.auth?.properties.username?.value).toBe("asdsd");
        expect(proxyConfig?.auth?.properties.disabled?.value).toBe(true);
        expect(proxyConfig?.bypassProxy?.value).toBe("asdasd");
        expect(clientCertificates).toHaveLength(1);
        expect(clientCertificates?.[0].properties.type?.value).toBe("pem");
        expect(clientCertificates?.[0].properties.disabled?.value).toBe(true);
        expect(clientCertificates?.[0].properties.passphrase?.value).toBe(
            "asdasdasd",
        );

        const request = properties.request!.properties;
        expect(request.headers?.enabled).toHaveLength(1);
        expect(request.variables?.enabled).toHaveLength(2);
        expect(request.actions?.enabled).toHaveLength(1);
        expect(request.scripts).toHaveLength(3);
        expect(request.auth).toBeDefined();

        const bruno = properties.extensions!.properties.bruno!.properties;
        expect(bruno.ignore?.value.map(({ value }) => value)).toEqual([
            "node_modules",
            ".git",
        ]);
        expect(bruno.presets?.properties.defaultEnvironment?.value).toBe(
            "Env1",
        );
        expect(bruno.presets?.properties.request?.properties.url?.value).toBe(
            "asdasdas",
        );
        expect(
            bruno.scripts?.properties.additionalContextRoots?.value.map(
                ({ value }) => value,
            ),
        ).toEqual(["./path/to/shared/scripts"]);
    });

    it("parses file with only the mandatory properties defined", () => {
        const { result, errors } = parseCollectionSettingsFile(
            new TextDocumentHelper(
                `opencollection: 1.0.0\ninfo:\n  name: my collection`,
            ),
        );

        expect(errors).toHaveLength(0);
        expect(result!.properties.info?.properties.name?.value).toBe(
            "my collection",
        );
        expect(
            result!.missingProperties.filter(({ isMandatory }) => isMandatory),
        ).toHaveLength(0);
    });

    it("returns error if `info` section is missing", () => {
        const { result, errors } = parseCollectionSettingsFile(
            new TextDocumentHelper(`opencollection: 1.0.0\nbundled: true`),
        );

        expect(errors).toHaveLength(1);
        expect(errors[0].code).toBe(YamlParsingErrorCode.ItemDoesNotExist);
        expect(result!.properties.info).toBeUndefined();
        expect(result!.properties.bundled?.value).toBe(true);
    });

    it("returns error if `opencollection` is missing", () => {
        const { result, errors } = parseCollectionSettingsFile(
            new TextDocumentHelper(`info:\n  name: a`),
        );

        expect(errors).toHaveLength(1);
        expect(errors[0].code).toBe(YamlParsingErrorCode.ItemDoesNotExist);
        expect(result!.properties.opencollection).toBeUndefined();
    });

    it("returns error if `info.name` is missing", () => {
        const { result, errors } = parseCollectionSettingsFile(
            new TextDocumentHelper(`opencollection: 1.0.0\ninfo: {}`),
        );

        expect(errors).toHaveLength(1);
        expect(errors[0].code).toBe(YamlParsingErrorCode.ItemDoesNotExist);
        expect(result!.properties.info?.properties.name).toBeUndefined();
    });

    it("returns error for unknown top level key", () => {
        const { errors } = parseCollectionSettingsFile(
            new TextDocumentHelper(
                `opencollection: 1.0.0\ninfo:\n  name: a\nunknown: b`,
            ),
        );

        expect(errors).toHaveLength(1);
        expect(errors[0].code).toBe(YamlParsingErrorCode.UnknownFieldInMap);
    });

    it("returns errors for invalid values in config section", () => {
        const { result, errors } = parseCollectionSettingsFile(
            new TextDocumentHelper(`opencollection: 1.0.0
info:
  name: a
config:
  proxy:
    config:
      protocol: ftp
  clientCertificates:
    - type: pem
    - domain: x
      type: unknown
  protobuf:
    importPaths:
      - bla`),
        );

        // Invalid protocol, missing domain, invalid certificate type, import path that is not a map.
        expect(
            errors
                .map(({ code, range }) => ({ code, line: range.start.line }))
                .sort((a, b) => a.line - b.line),
        ).toEqual([
            { code: YamlParsingErrorCode.Other, line: 6 },
            { code: YamlParsingErrorCode.ItemDoesNotExist, line: 8 },
            { code: YamlParsingErrorCode.Other, line: 10 },
            { code: YamlParsingErrorCode.Other, line: 13 },
        ]);
        const config = result!.properties.config!.properties;
        expect(config.proxy?.properties.config?.properties.protocol).toBe(
            undefined,
        );
        expect(config.clientCertificates).toHaveLength(2);
        expect(config.protobuf?.properties.importPaths).toHaveLength(0);
    });

    it("returns error for invalid proto file type", () => {
        const { result, errors } = parseCollectionSettingsFile(
            new TextDocumentHelper(`opencollection: 1.0.0
info:
  name: a
config:
  protobuf:
    protoFiles:
      - type: folder
        path: ./protos`),
        );

        expect(errors).toHaveLength(1);
        expect(errors[0].range.start.line).toBe(6);
        const [protoFile] =
            result!.properties.config!.properties.protobuf!.properties
                .protoFiles!;
        expect(protoFile.properties.type).toBeUndefined();
        expect(protoFile.properties.path?.value).toBe("./protos");
    });

    it("returns errors for non-boolean `disabled` values in proxy section", () => {
        const { result, errors } = parseCollectionSettingsFile(
            new TextDocumentHelper(`opencollection: 1.0.0
info:
  name: a
config:
  proxy:
    disabled: yes please
    config:
      auth:
        disabled: 5`),
        );

        expect(errors).toHaveLength(2);
        const proxy = result!.properties.config!.properties.proxy!.properties;
        expect(proxy.disabled).toBeUndefined();
        expect(proxy.config?.properties.auth?.properties.disabled).toBe(
            undefined,
        );
    });

    it.each(["http", "graphql", "grpc", "ws"])(
        "accepts '%s' as preset request type",
        (type) => {
            const { result, errors } = parseCollectionSettingsFile(
                new TextDocumentHelper(`opencollection: 1.0.0
info:
  name: a
extensions:
  bruno:
    presets:
      request:
        type: ${type}`),
            );

            expect(errors).toHaveLength(0);
            expect(
                result!.properties.extensions?.properties.bruno?.properties
                    .presets?.properties.request?.properties.type?.value,
            ).toBe(type);
        },
    );

    it("returns error for invalid preset request type", () => {
        const { result, errors } = parseCollectionSettingsFile(
            new TextDocumentHelper(`opencollection: 1.0.0
info:
  name: a
extensions:
  bruno:
    presets:
      request:
        type: websocket`),
        );

        expect(errors).toHaveLength(1);
        expect(
            result!.properties.extensions?.properties.bruno?.properties.presets
                ?.properties.request?.properties.type,
        ).toBeUndefined();
    });

    it("returns error for non-boolean `disabled` value in client certificate", () => {
        const { result, errors } = parseCollectionSettingsFile(
            new TextDocumentHelper(`opencollection: 1.0.0
info:
  name: a
config:
  clientCertificates:
    - domain: x
      type: pem
      disabled: 5`),
        );

        expect(errors).toHaveLength(1);
        expect(
            result!.properties.config?.properties.clientCertificates?.[0]
                .properties.disabled,
        ).toBeUndefined();
    });

    it("returns errors for non-string entries in the ignore list", () => {
        const { result, errors } = parseCollectionSettingsFile(
            new TextDocumentHelper(`opencollection: 1.0.0
info:
  name: a
extensions:
  bruno:
    ignore:
      - 1
      - b`),
        );

        expect(errors).toHaveLength(1);
        expect(
            result!.properties.extensions?.properties.bruno?.properties.ignore,
        ).toBeUndefined();
    });
});
