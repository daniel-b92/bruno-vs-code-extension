import { YAMLMap, YAMLSeq } from "yaml";
import {
    Range,
    TextDocumentHelper,
    WithKeyAndValueRange,
    YamlMapMissingPropertyInfo,
    YamlParsingError,
} from "../../..";
import {
    ActionPhase,
    ActionSelectorMethod,
    ActionType,
    ActionVariableScope,
} from "../../external/yamlFormat/constants/actionConstants";
import {
    OAuth1Placement,
    OAuth1SignatureMethod,
} from "../../../languageUtils/shared/oAuth1FieldValueEnums";
import {
    ApiKeyPlacement,
    AuthType,
    OAuth2AdditionalParameterPlacement,
    OAuth2CredentialsPlacement,
    OAuth2Flow,
    OAuth2TokenSource,
} from "../../external/yamlFormat/constants/authConstants";
import {
    HttpBodyType,
    HttpParamType,
    WebsocketMessageType,
} from "../../external/yamlFormat/constants/requestFileConstants";
import {
    AssertionOperator,
    DocsType,
    ScriptType,
    VariableType,
} from "../../external/yamlFormat/constants/sharedConstants";

export interface CommonParsingArgs {
    docHelper: TextDocumentHelper;
    fullDocumentRange: Range;
}

export interface ParsedMapItems {
    validScalars: {
        withStringValue: WithKeyKeyRangeAndValueRange<string>[];
        withBooleanValue: WithKeyKeyRangeAndValueRange<boolean>[];
        withNumericValue: WithKeyKeyRangeAndValueRange<number>[];
    };
    validSequences: WithKeyAndKeyRange<YAMLSeq>[];
    validMaps: WithKeyAndKeyRange<YAMLMap>[];
    missingKeys: string[];
    unknownKeys: { key: string; keyRange: Range }[];
}

export type ParsedRequestVariable = ParsedYamlMapWithValueRange<{
    name?: WithKeyAndValueRange<string>;
    value?:
        | WithKeyAndValueRange<string>
        | ParsedYamlMapWithKeyAndValueRange<{
              type?: WithKeyAndValueRange<VariableType>;
              data?: WithKeyAndValueRange<string>;
          }>;
    description?: WithKeyAndValueRange<string>;
    disabled: OptionalVariableFieldResult<boolean>;
}>;

export type ParsedAction = ParsedYamlMapWithValueRange<{
    type?: WithKeyAndValueRange<ActionType>;
    phase?: WithKeyAndValueRange<ActionPhase>;
    selector?: ParsedYamlMapWithKeyAndValueRange<{
        expression?: WithKeyAndValueRange<string>;
        method?: WithKeyAndValueRange<ActionSelectorMethod>;
    }>;
    variable?: ParsedYamlMapWithKeyAndValueRange<{
        name?: WithKeyAndValueRange<string>;
        scope?: WithKeyAndValueRange<ActionVariableScope>;
    }>;
    description?: WithKeyAndValueRange<string>;
    disabled: OptionalVariableFieldResult<boolean>;
}>;

export type ParsedRequestHeader = ParsedYamlMapWithValueRange<{
    name?: WithKeyAndValueRange<string>;
    value?: WithKeyAndValueRange<string>;
    description?: WithKeyAndValueRange<string>;
    disabled: OptionalVariableFieldResult<boolean>;
}>;

export type ParsedScript = ParsedYamlMapWithValueRange<{
    type?: WithKeyAndValueRange<ScriptType>;
    code?: WithKeyAndValueRange<string>;
}>;

export type ParsedAssertion = ParsedYamlMapWithValueRange<{
    expression?: WithKeyAndValueRange<string>;
    operator?: WithKeyAndValueRange<AssertionOperator>;
    value?: WithKeyAndValueRange<string>;
    description?: WithKeyAndValueRange<string>;
    disabled: OptionalVariableFieldResult<boolean>;
}>;

/** Items of a sequence, split by their `disabled` property. */
export interface EnabledAndDisabledItems<T> {
    enabled: T[];
    disabled: T[];
}

export type ParsedRequestFileAppSection = ParsedYamlMapWithKeyAndValueRange<{
    enabled?: WithKeyAndValueRange<boolean>;
    code?: WithKeyAndValueRange<string>;
}>;

export type ParsedHttpParam = ParsedYamlMapWithValueRange<{
    name?: WithKeyAndValueRange<string>;
    value?: WithKeyAndValueRange<string>;
    type?: WithKeyAndValueRange<HttpParamType>;
    description?: WithKeyAndValueRange<string>;
    disabled: OptionalVariableFieldResult<boolean>;
}>;

export type ParsedStringScalarWithStyle = WithKeyAndValueRange<string> & {
    /** Whether the value is a literal block scalar (`|`, `|-`, `|+`). */
    isLiteralBlockScalar: boolean;
};

export type ParsedHttpBody = ParsedYamlMapWithKeyAndValueRange<{
    type?: WithKeyAndValueRange<HttpBodyType>;
    data?: ParsedStringScalarWithStyle;
}>;

export type ParsedGraphqlBody = ParsedYamlMapWithKeyAndValueRange<{
    query?: WithKeyAndValueRange<string>;
    variables?: ParsedStringScalarWithStyle;
}>;

export type ParsedWebsocketMessageContent = ParsedYamlMapWithKeyAndValueRange<{
    type?: WithKeyAndValueRange<WebsocketMessageType>;
    data?: ParsedStringScalarWithStyle;
}>;

export type ParsedWebsocketMessage = ParsedYamlMapWithValueRange<{
    title?: WithKeyAndValueRange<string>;
    selected?: WithKeyAndValueRange<boolean>;
    message?: ParsedWebsocketMessageContent;
}>;

export type ParsedDocsWithType = WithKeyAndValueRange<
    | string
    | ParsedYamlMap<{
          type?: WithKeyAndValueRange<DocsType>;
          content?: WithKeyAndValueRange<string>;
      }>
>;

export type ParsedSettings = ParsedYamlMapWithKeyAndValueRange<{
    encodeUrl?: WithKeyAndValueRange<boolean>;
    timeout?: WithKeyAndValueRange<"inherit"> | WithKeyAndValueRange<number>;
    followRedirects?: WithKeyAndValueRange<boolean>;
    maxRedirects?: WithKeyAndValueRange<number>;
    forwardAuthorizationHeader?: WithKeyAndValueRange<boolean>;
    keepAliveInterval?: WithKeyAndValueRange<number>;
}>;

export type ParsedSettingsFileRequestSection =
    ParsedYamlMapWithKeyAndValueRange<{
        headers?: EnabledAndDisabledItems<ParsedRequestHeader>;
        auth?: ParsedAuth;
        variables?: EnabledAndDisabledItems<ParsedRequestVariable>;
        actions?: EnabledAndDisabledItems<ParsedAction>;
        scripts?: ParsedScript[];
    }>;

export type ParsedAuth = WithKeyAndValueRange<
    ParsedInheritAuth | ParsedAuthWithType
>;

export type ParsedAuthWithType =
    | ParsedBasicAuth
    | ParsedBearerAuth
    | ParsedAwsV4Auth
    | ParsedDigestAuth
    | ParsedWsseAuth
    | ParsedNtlmAuth
    | ParsedApiKeyAuth
    | ParsedAkamaiEdgegridAuth
    | ParsedOAuth1Auth
    | ParsedOAuth2Auth;

export type ParsedBasicAuth = ParsedYamlMap<{
    type: WithKeyAndValueRange<AuthType.Basic>;
    username?: WithKeyAndValueRange<string>;
    password?: WithKeyAndValueRange<string>;
}>;

export type ParsedBearerAuth = ParsedYamlMap<{
    type: WithKeyAndValueRange<AuthType.Bearer>;
    token?: WithKeyAndValueRange<string>;
}>;

export type ParsedAwsV4Auth = ParsedYamlMap<{
    type: WithKeyAndValueRange<AuthType.Awsv4>;
    accessKeyId?: WithKeyAndValueRange<string>;
    secretAccessKey?: WithKeyAndValueRange<string>;
    sessionToken?: WithKeyAndValueRange<string>;
    service?: WithKeyAndValueRange<string>;
    region?: WithKeyAndValueRange<string>;
    profileName?: WithKeyAndValueRange<string>;
}>;

export type ParsedDigestAuth = ParsedYamlMap<{
    type: WithKeyAndValueRange<AuthType.Digest>;
    username?: WithKeyAndValueRange<string>;
    password?: WithKeyAndValueRange<string>;
}>;

export type ParsedWsseAuth = ParsedYamlMap<{
    type: WithKeyAndValueRange<AuthType.Wsse>;
    username?: WithKeyAndValueRange<string>;
    password?: WithKeyAndValueRange<string>;
}>;

export type ParsedNtlmAuth = ParsedYamlMap<{
    type: WithKeyAndValueRange<AuthType.Ntlm>;
    username?: WithKeyAndValueRange<string>;
    password?: WithKeyAndValueRange<string>;
    domain?: WithKeyAndValueRange<string>;
}>;

export type ParsedApiKeyAuth = ParsedYamlMap<{
    type: WithKeyAndValueRange<AuthType.Apikey>;
    key?: WithKeyAndValueRange<string>;
    value?: WithKeyAndValueRange<string>;
    placement?: WithKeyAndValueRange<ApiKeyPlacement>;
}>;

export type ParsedAkamaiEdgegridAuth = ParsedYamlMap<{
    type: WithKeyAndValueRange<AuthType.AkamaiEdgegrid>;
    accessToken?: WithKeyAndValueRange<string>;
    clientToken?: WithKeyAndValueRange<string>;
    clientSecret?: WithKeyAndValueRange<string>;
    nonce?: WithKeyAndValueRange<string>;
    timestamp?: WithKeyAndValueRange<string>;
    baseURL?: WithKeyAndValueRange<string>;
    headersToSign?: WithKeyAndValueRange<string>;
    maxBodySize?: WithKeyAndValueRange<number>;
}>;

export type ParsedOAuth1Auth = ParsedYamlMap<{
    type: WithKeyAndValueRange<AuthType.Oauth1>;
    consumerKey?: WithKeyAndValueRange<string>;
    consumerSecret?: WithKeyAndValueRange<string>;
    accessToken?: WithKeyAndValueRange<string>;
    accessTokenSecret?: WithKeyAndValueRange<string>;
    callbackUrl?: WithKeyAndValueRange<string>;
    verifier?: WithKeyAndValueRange<string>;
    signatureMethod?: WithKeyAndValueRange<OAuth1SignatureMethod>;
    privateKey?: WithKeyAndValueRange<string>;
    timestamp?: WithKeyAndValueRange<string>;
    nonce?: WithKeyAndValueRange<string>;
    version?: WithKeyAndValueRange<string>;
    realm?: WithKeyAndValueRange<string>;
    placement?: WithKeyAndValueRange<OAuth1Placement>;
    includeBodyHash?: WithKeyAndValueRange<boolean>;
}>;

export type ParsedOAuth2Auth = ParsedYamlMap<{
    type: WithKeyAndValueRange<AuthType.Oauth2>;
    flow?: WithKeyAndValueRange<OAuth2Flow>;
    authorizationUrl?: WithKeyAndValueRange<string>;
    accessTokenUrl?: WithKeyAndValueRange<string>;
    refreshTokenUrl?: WithKeyAndValueRange<string>;
    callbackUrl?: WithKeyAndValueRange<string>;
    scope?: WithKeyAndValueRange<string>;
    state?: WithKeyAndValueRange<string>;
    credentials?: ParsedYamlMapWithKeyAndValueRange<{
        clientId?: WithKeyAndValueRange<string>;
        clientSecret?: WithKeyAndValueRange<string>;
        placement?: WithKeyAndValueRange<OAuth2CredentialsPlacement>;
    }>;
    resourceOwner?: ParsedYamlMapWithKeyAndValueRange<{
        username?: WithKeyAndValueRange<string>;
        password?: WithKeyAndValueRange<string>;
    }>;
    /** Has no properties of its own. An empty map (`pkce: {}`) is how PKCE gets enabled. */
    pkce?: ParsedYamlMapWithKeyAndValueRange<{}>;
    additionalParameters?: ParsedYamlMapWithKeyAndValueRange<{
        authorizationRequest?: ParsedOAuth2AdditionalParameter[];
        accessTokenRequest?: ParsedOAuth2AdditionalParameter[];
        refreshTokenRequest?: ParsedOAuth2AdditionalParameter[];
    }>;
    tokenConfig?: ParsedYamlMapWithKeyAndValueRange<{
        id?: WithKeyAndValueRange<string>;
        placement?: ParsedYamlMapWithKeyAndValueRange<{
            header?: WithKeyAndValueRange<string>;
            /** `null`, if the key is defined without a value. */
            query?: WithKeyAndValueRange<string | null>;
        }>;
        source?: WithKeyAndValueRange<OAuth2TokenSource>;
    }>;
    settings?: ParsedYamlMapWithKeyAndValueRange<{
        autoFetchToken?: WithKeyAndValueRange<boolean>;
        autoRefreshToken?: WithKeyAndValueRange<boolean>;
    }>;
}>;

export type ParsedOAuth2AdditionalParameter = ParsedYamlMapWithValueRange<{
    name?: WithKeyAndValueRange<string>;
    value?: WithKeyAndValueRange<string>;
    placement?: WithKeyAndValueRange<OAuth2AdditionalParameterPlacement>;
}>;

export interface ParsedInheritAuth {}

export type ParsedYamlMapWithKeyAndValueRange<T> =
    ParsedYamlMapWithValueRange<T> & {
        keyRange: Range;
    };

export type ParsedYamlMapWithValueRange<T> = ParsedYamlMap<T> & {
    valueRange: Range;
};

export type ParsedYamlMap<T> = {
    properties: T;
    missingProperties: YamlMapMissingPropertyInfo[];
};

export type MaybeResultWithErrors<T> = {
    result?: T;
    errors: YamlParsingError[];
};

export type OptionalVariableFieldResult<T> = {
    effectiveValue: T;
    field?: WithKeyAndValueRange<T>;
};

export type WithKeyKeyRangeAndValueRange<T> = WithKeyAndValueRange<T> & {
    key: string;
};

export type WithKeyAndKeyRange<T> = { value: T; key: string; keyRange: Range };
