import { describe, it, expect } from "@jest/globals";
import {
    getExpectedKeyRange,
    getExpectedSameLineValueRange,
    parseTextIntoYamlDocument,
} from "../../../../_testingUtils";
import { Position, Range, TextDocumentHelper } from "../../../..";
import {
    OAuth1Placement,
    OAuth1SignatureMethod,
} from "../../../../languageUtils/shared/oAuth1FieldValueEnums";
import { parseAuthFromYamlMapOrScalar } from "./parseAuthFromYamlMapOrScalar";
import {
    ParsedAkamaiEdgegridAuth,
    ParsedApiKeyAuth,
    ParsedAuth,
    ParsedAwsV4Auth,
    ParsedBasicAuth,
    ParsedDigestAuth,
    ParsedNtlmAuth,
    ParsedOAuth1Auth,
    ParsedOAuth2Auth,
    ParsedWsseAuth,
    WithKeyAndKeyRange,
    WithKeyKeyRangeAndValueRange,
} from "../interfaces";
import { YAMLMap } from "yaml";
import {
    ApiKeyPlacement,
    AuthType,
    BasicAuthProperty,
    OAuth2AdditionalParameterPlacement,
    OAuth2CredentialsPlacement,
    OAuth2Flow,
    OAuth2TokenSource,
} from "../../../external/yamlFormat/constants/authConstants";

describe("parseAuthFromYamlMapOrScalar", () => {
    it("parses auth of type 'inherit'", () => {
        const documentText = `auth: inherit`;

        const source: WithKeyKeyRangeAndValueRange<string> = {
            key: "auth",
            keyRange: getExpectedKeyRange(0, "auth", 0),
            value: "inherit",
            valueRange: getExpectedSameLineValueRange(0, "auth", "inherit", 0),
        };
        const docHelper = new TextDocumentHelper(documentText);
        const fullDocumentRange = docHelper.getTextRange();
        const { result, errors } = parseAuthFromYamlMapOrScalar({
            authMapOrScalar: source,
            commonArgs: { docHelper, fullDocumentRange },
        });

        expect(errors).toHaveLength(0);
        expect(result).toBeDefined();
        expect(result?.keyRange).toEqual(source.keyRange);
        expect(result?.valueRange).toEqual(source.valueRange);
        expect(result?.value).toEqual({});
    });

    it("returns an error for invalid scalar value", () => {
        const documentText = `auth: inherits`;

        const source: WithKeyKeyRangeAndValueRange<string> = {
            key: "auth",
            keyRange: getExpectedKeyRange(0, "auth", 0),
            value: "inherits",
            valueRange: getExpectedSameLineValueRange(0, "auth", "inherits", 0),
        };
        const docHelper = new TextDocumentHelper(documentText);
        const fullDocumentRange = docHelper.getTextRange();
        const { result, errors } = parseAuthFromYamlMapOrScalar({
            authMapOrScalar: source,
            commonArgs: { docHelper, fullDocumentRange },
        });

        expect(errors).toHaveLength(1);
        expect(errors[0].range).toEqual(
            getExpectedSameLineValueRange(0, "auth", "inherits", 0),
        );
        expect(result).toBeUndefined();
    });

    it("parses auth of type 'basic'", () => {
        const documentText = `auth:
    type: basic
    username: sdgfdg
    password: sdgdfgf`;

        const docHelper = new TextDocumentHelper(documentText);
        const fullDocumentRange = docHelper.getTextRange();
        const parsedDocument = parseTextIntoYamlDocument(documentText);
        const authMap = (parsedDocument.contents as YAMLMap).items[0]
            .value as YAMLMap;
        const source: WithKeyAndKeyRange<YAMLMap> = {
            key: "auth",
            keyRange: getExpectedKeyRange(0, "auth", 0),
            value: authMap,
        };

        const { result, errors } = parseAuthFromYamlMapOrScalar({
            authMapOrScalar: source,
            commonArgs: { docHelper, fullDocumentRange },
        });

        expect(errors).toHaveLength(0);
        expect(result).toBeDefined();
        expect(result?.keyRange).toEqual(source.keyRange);

        const expectedValue: ParsedBasicAuth = {
            missingProperties: [],
            properties: {
                type: {
                    keyRange: getExpectedKeyRange(1, BasicAuthProperty.Type, 4),
                    valueRange: getExpectedSameLineValueRange(
                        1,
                        BasicAuthProperty.Type,
                        AuthType.Basic,
                        4,
                    ),
                    value: AuthType.Basic,
                },
                username: {
                    keyRange: getExpectedKeyRange(
                        2,
                        BasicAuthProperty.Username,
                        4,
                    ),
                    valueRange: getExpectedSameLineValueRange(
                        2,
                        BasicAuthProperty.Username,
                        "sdgfdg",
                        4,
                    ),
                    value: "sdgfdg",
                },
                password: {
                    keyRange: getExpectedKeyRange(
                        3,
                        BasicAuthProperty.Password,
                        4,
                    ),
                    valueRange: getExpectedSameLineValueRange(
                        3,
                        BasicAuthProperty.Password,
                        "sdgdfgf",
                        4,
                    ),
                    value: "sdgdfgf",
                },
            },
        };
        expect(result?.value).toEqual(expectedValue);
    });

    it("partially parses auth of type 'basic' containing invalid properties", () => {
        const documentText = `auth:
    type: basic
    username: 
        username : ererer
    password: sdgdfgf
    asasas: 54545`;

        const docHelper = new TextDocumentHelper(documentText);
        const fullDocumentRange = docHelper.getTextRange();
        const parsedDocument = parseTextIntoYamlDocument(documentText);
        const authMap = (parsedDocument.contents as YAMLMap).items[0]
            .value as YAMLMap;
        const source: WithKeyAndKeyRange<YAMLMap> = {
            key: "auth",
            keyRange: getExpectedKeyRange(0, "auth", 0),
            value: authMap,
        };

        const { result, errors } = parseAuthFromYamlMapOrScalar({
            authMapOrScalar: source,
            commonArgs: { docHelper, fullDocumentRange },
        });

        expect(errors).toHaveLength(2);
        // Error for invalid value type for 'username' property.
        expect(
            errors.some(({ range }) =>
                range.equals(new Range(new Position(3, 8), new Position(4, 0))),
            ),
        ).toBeTruthy();
        // Error for unknown key.
        expect(
            errors.some(({ range }) =>
                range.equals(getExpectedKeyRange(5, "asasas", 4)),
            ),
        ).toBeTruthy();

        expect(result).toBeDefined();
        const auth = result?.value as ParsedBasicAuth;
        expect(auth.missingProperties).toHaveLength(0);
        expect(auth.properties.username).toBeUndefined();
        expect(auth.properties.password).toEqual({
            keyRange: getExpectedKeyRange(4, BasicAuthProperty.Password, 4),
            valueRange: getExpectedSameLineValueRange(
                4,
                BasicAuthProperty.Password,
                "sdgdfgf",
                4,
            ),
            value: "sdgdfgf",
        });
    });

    it("parses auth of type 'awsv4'", () => {
        const { result, errors } = parseAuth(`auth:
    type: awsv4
    accessKeyId: id
    secretAccessKey: secret
    sessionToken: token
    service: s3
    region: eu-west-1
    profileName: profile`);

        expect(errors).toHaveLength(0);
        const auth = result?.value as ParsedAwsV4Auth;
        expect(auth.missingProperties).toHaveLength(0);
        expect(auth.properties.type.value).toBe(AuthType.Awsv4);
        expect(auth.properties.accessKeyId?.value).toBe("id");
        expect(auth.properties.secretAccessKey?.value).toBe("secret");
        expect(auth.properties.sessionToken?.value).toBe("token");
        expect(auth.properties.service?.value).toBe("s3");
        expect(auth.properties.region?.value).toBe("eu-west-1");
        expect(auth.properties.profileName?.value).toBe("profile");
    });

    it("parses auth of type 'digest'", () => {
        const { result, errors } = parseAuth(`auth:
    type: digest
    username: user
    password: pw`);

        expect(errors).toHaveLength(0);
        const auth = result?.value as ParsedDigestAuth;
        expect(auth.properties.type.value).toBe(AuthType.Digest);
        expect(auth.properties.username?.value).toBe("user");
        expect(auth.properties.password?.value).toBe("pw");
    });

    it("parses auth of type 'wsse'", () => {
        const { result, errors } = parseAuth(`auth:
    type: wsse
    username: user
    password: pw`);

        expect(errors).toHaveLength(0);
        const auth = result?.value as ParsedWsseAuth;
        expect(auth.properties.type.value).toBe(AuthType.Wsse);
        expect(auth.properties.username?.value).toBe("user");
        expect(auth.properties.password?.value).toBe("pw");
    });

    it("parses auth of type 'ntlm'", () => {
        const { result, errors } = parseAuth(`auth:
    type: ntlm
    username: user
    password: pw
    domain: dom`);

        expect(errors).toHaveLength(0);
        const auth = result?.value as ParsedNtlmAuth;
        expect(auth.properties.type.value).toBe(AuthType.Ntlm);
        expect(auth.properties.username?.value).toBe("user");
        expect(auth.properties.password?.value).toBe("pw");
        expect(auth.properties.domain?.value).toBe("dom");
    });

    it("parses auth of type 'apikey'", () => {
        const { result, errors } = parseAuth(`auth:
    type: apikey
    key: k
    value: v
    placement: query`);

        expect(errors).toHaveLength(0);
        const auth = result?.value as ParsedApiKeyAuth;
        expect(auth.properties.type.value).toBe(AuthType.Apikey);
        expect(auth.properties.key?.value).toBe("k");
        expect(auth.properties.value?.value).toBe("v");
        expect(auth.properties.placement?.value).toBe(ApiKeyPlacement.Query);
    });

    it("returns an error for an invalid placement of auth type 'apikey'", () => {
        const { result, errors } = parseAuth(`auth:
    type: apikey
    key: k
    placement: cookie`);

        expect(errors).toHaveLength(1);
        expect(errors[0].range).toEqual(
            getExpectedSameLineValueRange(3, "placement", "cookie", 4),
        );
        const auth = result?.value as ParsedApiKeyAuth;
        expect(auth.properties.key?.value).toBe("k");
        expect(auth.properties.placement).toBeUndefined();
    });

    it("parses auth of type 'akamai-edgegrid'", () => {
        const { result, errors } = parseAuth(`auth:
    type: akamai-edgegrid
    accessToken: at
    clientToken: ct
    clientSecret: cs
    nonce: n
    timestamp: t
    baseURL: ""
    headersToSign: a,b
    maxBodySize: 454545`);

        expect(errors).toHaveLength(0);
        const auth = result?.value as ParsedAkamaiEdgegridAuth;
        expect(auth.missingProperties).toHaveLength(0);
        expect(auth.properties.type.value).toBe(AuthType.AkamaiEdgegrid);
        expect(auth.properties.accessToken?.value).toBe("at");
        expect(auth.properties.clientToken?.value).toBe("ct");
        expect(auth.properties.clientSecret?.value).toBe("cs");
        expect(auth.properties.nonce?.value).toBe("n");
        expect(auth.properties.timestamp?.value).toBe("t");
        expect(auth.properties.baseURL?.value).toBe("");
        expect(auth.properties.headersToSign?.value).toBe("a,b");
        expect(auth.properties.maxBodySize?.value).toBe(454545);
    });

    it("parses auth of type 'oauth1'", () => {
        const { result, errors } = parseAuth(`auth:
    type: oauth1
    consumerKey: ck
    consumerSecret: cs
    accessToken: at
    accessTokenSecret: ats
    callbackUrl: cb
    verifier: ver
    signatureMethod: HMAC-SHA1
    timestamp: ts
    nonce: n
    version: "1.0"
    realm: r
    placement: header
    includeBodyHash: false`);

        expect(errors).toHaveLength(0);
        const auth = result?.value as ParsedOAuth1Auth;
        expect(auth.properties.type.value).toBe(AuthType.Oauth1);
        expect(auth.properties.consumerKey?.value).toBe("ck");
        expect(auth.properties.accessTokenSecret?.value).toBe("ats");
        expect(auth.properties.signatureMethod?.value).toBe(
            OAuth1SignatureMethod.HMAC_SHA1,
        );
        expect(auth.properties.version?.value).toBe("1.0");
        expect(auth.properties.placement?.value).toBe(OAuth1Placement.Header);
        expect(auth.properties.includeBodyHash?.value).toBe(false);
    });

    it("returns an error for an invalid signature method of auth type 'oauth1'", () => {
        const { result, errors } = parseAuth(`auth:
    type: oauth1
    consumerKey: ck
    signatureMethod: MD5`);

        expect(errors).toHaveLength(1);
        expect(errors[0].range).toEqual(
            getExpectedSameLineValueRange(3, "signatureMethod", "MD5", 4),
        );
        const auth = result?.value as ParsedOAuth1Auth;
        expect(auth.properties.consumerKey?.value).toBe("ck");
        expect(auth.properties.signatureMethod).toBeUndefined();
    });

    it("parses auth of type 'oauth2' with all nested sections", () => {
        const { result, errors } = parseAuth(`auth:
    type: oauth2
    flow: authorization_code
    authorizationUrl: auth-url
    accessTokenUrl: token-url
    refreshTokenUrl: refresh-url
    callbackUrl: callback
    credentials:
        clientId: id
        clientSecret: secret
        placement: basic_auth_header
    resourceOwner:
        username: user
        password: pw
    scope: sc
    state: st
    pkce: {}
    additionalParameters:
        authorizationRequest:
            - name: a
              value: b
              placement: query
        accessTokenRequest:
            - name: c
              value: d
              placement: body
        refreshTokenRequest:
            - name: e
              value: f
              placement: header
    tokenConfig:
        id: credentials
        placement:
            header: Bearer
        source: id_token
    settings:
        autoFetchToken: true
        autoRefreshToken: false`);

        expect(errors).toHaveLength(0);
        const auth = result?.value as ParsedOAuth2Auth;
        expect(auth.missingProperties).toHaveLength(0);
        const { properties } = auth;
        expect(properties.type.value).toBe(AuthType.Oauth2);
        expect(properties.flow?.value).toBe(OAuth2Flow.AuthorizationCode);
        expect(properties.authorizationUrl?.value).toBe("auth-url");
        expect(properties.accessTokenUrl?.value).toBe("token-url");
        expect(properties.refreshTokenUrl?.value).toBe("refresh-url");
        expect(properties.callbackUrl?.value).toBe("callback");
        expect(properties.scope?.value).toBe("sc");
        expect(properties.state?.value).toBe("st");
        expect(properties.pkce).toBeDefined();

        const credentials = properties.credentials?.properties;
        expect(credentials?.clientId?.value).toBe("id");
        expect(credentials?.clientSecret?.value).toBe("secret");
        expect(credentials?.placement?.value).toBe(
            OAuth2CredentialsPlacement.BasicAuthHeader,
        );

        const resourceOwner = properties.resourceOwner?.properties;
        expect(resourceOwner?.username?.value).toBe("user");
        expect(resourceOwner?.password?.value).toBe("pw");

        const additional = properties.additionalParameters?.properties;
        expect(additional?.authorizationRequest).toHaveLength(1);
        expect(
            additional?.authorizationRequest?.[0].properties.placement?.value,
        ).toBe(OAuth2AdditionalParameterPlacement.Query);
        expect(additional?.accessTokenRequest?.[0].properties.name?.value).toBe(
            "c",
        );
        expect(
            additional?.refreshTokenRequest?.[0].properties.value?.value,
        ).toBe("f");

        const tokenConfig = properties.tokenConfig?.properties;
        expect(tokenConfig?.id?.value).toBe("credentials");
        expect(tokenConfig?.source?.value).toBe(OAuth2TokenSource.IdToken);
        expect(tokenConfig?.placement?.properties.header?.value).toBe("Bearer");
        expect(tokenConfig?.placement?.properties.query).toBeUndefined();

        const settings = properties.settings?.properties;
        expect(settings?.autoFetchToken?.value).toBe(true);
        expect(settings?.autoRefreshToken?.value).toBe(false);
    });

    it("parses auth of type 'oauth2' with a token placement in query without value", () => {
        const { result, errors } = parseAuth(`auth:
    type: oauth2
    flow: implicit
    tokenConfig:
        placement:
            query: null`);

        expect(errors).toHaveLength(0);
        const placement = (result?.value as ParsedOAuth2Auth).properties
            .tokenConfig?.properties.placement;
        expect(placement?.properties.query?.value).toBeNull();
        expect(placement?.properties.query?.keyRange).toEqual(
            getExpectedKeyRange(5, "query", 12),
        );
        expect(placement?.properties.header).toBeUndefined();
        expect(placement?.missingProperties).toEqual([
            { key: "header", isMandatory: false, alwaysHasScalarValue: true },
        ]);
    });

    it("returns errors for invalid values within auth of type 'oauth2'", () => {
        const { result, errors } = parseAuth(`auth:
    type: oauth2
    flow: unknown_flow
    credentials:
        placement: somewhere
    additionalParameters:
        accessTokenRequest:
            - value: b
    unknownKey: 5`);

        // Invalid flow, invalid credentials placement, missing parameter name, unknown key.
        expect(errors).toHaveLength(4);
        const { properties } = result?.value as ParsedOAuth2Auth;
        expect(properties.flow).toBeUndefined();
        expect(properties.credentials?.properties.placement).toBeUndefined();
        expect(
            properties.additionalParameters?.properties.accessTokenRequest?.[0]
                .properties.value?.value,
        ).toBe("b");
    });
});

function parseAuth(documentText: string): {
    result?: ParsedAuth;
    errors: ReturnType<typeof parseAuthFromYamlMapOrScalar>["errors"];
} {
    const docHelper = new TextDocumentHelper(documentText);
    const fullDocumentRange = docHelper.getTextRange();
    const parsedDocument = parseTextIntoYamlDocument(documentText);
    const authMap = (parsedDocument.contents as YAMLMap).items[0]
        .value as YAMLMap;

    return parseAuthFromYamlMapOrScalar({
        authMapOrScalar: {
            key: "auth",
            keyRange: getExpectedKeyRange(0, "auth", 0),
            value: authMap,
        },
        commonArgs: { docHelper, fullDocumentRange },
    });
}
