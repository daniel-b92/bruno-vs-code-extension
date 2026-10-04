import { Range } from "../../..";
import { FileInfoType, VariableType } from "./constants/sharedConstants";
import {
    BrunoPresetsRequestType,
    ClientCertificateType,
    ProtoFileType,
    ProxyProtocol,
} from "./constants/collectionSettingsFileConstants";
import {
    OptionalVariableFieldResult,
    ParsedAction,
    ParsedAssertion,
    ParsedAuth,
    ParsedDocsWithType,
    ParsedGraphqlBody,
    ParsedHttpBody,
    ParsedHttpParam,
    ParsedRequestFileAppSection,
    ParsedRequestHeader,
    ParsedRequestVariable,
    ParsedScript,
    ParsedSettingsFileRequestSection,
    ParsedSettings,
    ParsedYamlMap,
    ParsedYamlMapWithKeyAndValueRange,
    ParsedYamlMapWithValueRange,
    EnabledAndDisabledItems,
} from "../../internal/yamlFormat/interfaces";

export enum YamlParsingErrorCode {
    ItemDoesNotExist = 1,
    UnknownFieldInMap = 2,
    InvalidYamlSyntax = 3,
    Other = 99,
}

export interface YamlParsingError {
    message: string;
    range: Range;
    code: YamlParsingErrorCode;
}

export type ParsedRequestFile = ParsedYamlMap<{
    info?: ParsedInfoForRequestFile;
    http?: ParsedYamlMapWithKeyAndValueRange<{
        method?: WithKeyAndValueRange<string>;
        url?: WithKeyAndValueRange<string>;
        headers?: EnabledAndDisabledItems<ParsedRequestHeader>;
        params?: EnabledAndDisabledItems<ParsedHttpParam>;
        body?: ParsedHttpBody;
        auth?: ParsedAuth;
    }>;
    graphql?: ParsedYamlMapWithKeyAndValueRange<{
        method?: WithKeyAndValueRange<string>;
        url?: WithKeyAndValueRange<string>;
        headers?: EnabledAndDisabledItems<ParsedRequestHeader>;
        body?: ParsedGraphqlBody;
        auth?: ParsedAuth;
    }>;
    runtime?: ParsedYamlMapWithKeyAndValueRange<{
        variables?: EnabledAndDisabledItems<ParsedRequestVariable>;
        actions?: EnabledAndDisabledItems<ParsedAction>;
        assertions?: EnabledAndDisabledItems<ParsedAssertion>;
        scripts?: ParsedScript[];
    }>;
    settings?: ParsedSettings;
    docs?: WithKeyAndValueRange<string>;
    app?: ParsedRequestFileAppSection;
    /**
     * All top-level sections that are specific for a request type (e.g. `http` or `graphql`).
     * Includes the sections that are not (yet) parsed in detail.
     */
    requestTypeSections: { name: string; keyRange: Range }[];
}>;

export type ParsedAppFile = ParsedYamlMap<{
    info?: ParsedInfoForAppFile;
    code?: WithKeyAndValueRange<string>;
}>;

export type ParsedFolderSettingsFile = ParsedYamlMap<{
    info?: ParsedInfoForFolderSettings;
    request?: ParsedSettingsFileRequestSection;
    docs?: ParsedDocsWithType;
}>;

export type ParsedCollectionSettingsFile = ParsedYamlMap<{
    opencollection?: WithKeyAndValueRange<string>;
    info?: ParsedInfoForCollectionSettings;
    config?: ParsedYamlMapWithKeyAndValueRange<{
        protobuf?: ParsedYamlMapWithKeyAndValueRange<{
            protoFiles?: ParsedYamlMapWithValueRange<{
                type?: WithKeyAndValueRange<ProtoFileType>;
                path?: WithKeyAndValueRange<string>;
            }>[];
            importPaths?: ParsedYamlMapWithValueRange<{
                path?: WithKeyAndValueRange<string>;
            }>[];
        }>;
        proxy?: ParsedYamlMapWithKeyAndValueRange<{
            inherit?: WithKeyAndValueRange<boolean>;
            disabled?: WithKeyAndValueRange<boolean>;
            config?: ParsedYamlMapWithKeyAndValueRange<{
                protocol?: WithKeyAndValueRange<ProxyProtocol>;
                hostname?: WithKeyAndValueRange<string>;
                port?: WithKeyAndValueRange<number>;
                auth?: ParsedYamlMapWithKeyAndValueRange<{
                    username?: WithKeyAndValueRange<string>;
                    password?: WithKeyAndValueRange<string>;
                    disabled?: WithKeyAndValueRange<boolean>;
                }>;
                bypassProxy?: WithKeyAndValueRange<string>;
            }>;
        }>;
        clientCertificates?: ParsedYamlMapWithValueRange<{
            domain?: WithKeyAndValueRange<string>;
            type?: WithKeyAndValueRange<ClientCertificateType>;
            certificateFilePath?: WithKeyAndValueRange<string>;
            privateKeyFilePath?: WithKeyAndValueRange<string>;
            pfxFilePath?: WithKeyAndValueRange<string>;
            passphrase?: WithKeyAndValueRange<string>;
            disabled?: WithKeyAndValueRange<boolean>;
        }>[];
    }>;
    request?: ParsedSettingsFileRequestSection;
    docs?: ParsedDocsWithType;
    bundled?: WithKeyAndValueRange<boolean>;
    extensions?: ParsedYamlMapWithKeyAndValueRange<{
        bruno?: ParsedYamlMapWithKeyAndValueRange<{
            ignore?: WithKeyAndValueRange<{ value: string; range: Range }[]>;
            presets?: ParsedYamlMapWithKeyAndValueRange<{
                request?: ParsedYamlMapWithKeyAndValueRange<{
                    type?: WithKeyAndValueRange<BrunoPresetsRequestType>;
                    url?: WithKeyAndValueRange<string>;
                }>;
                defaultEnvironment?: WithKeyAndValueRange<string>;
            }>;
            scripts?: ParsedYamlMapWithKeyAndValueRange<{
                additionalContextRoots?: WithKeyAndValueRange<
                    { value: string; range: Range }[]
                >;
            }>;
        }>;
    }>;
}>;

export type ParsedInfoForRequestFile = ParsedInfoWithTypeAndSequence & {
    properties: {
        tags?: WithKeyAndValueRange<{ value: string; range: Range }[]>;
    };
};

export type ParsedInfoForFolderSettings = ParsedInfoWithTypeAndSequence;

export type ParsedInfoForAppFile = ParsedInfoWithTypeAndSequence;

export type ParsedInfoWithTypeAndSequence = ParsedInfoForCollectionSettings & {
    properties: {
        type?: WithKeyAndValueRange<FileInfoType>;
        sequence?: WithKeyAndValueRange<number>;
    };
};

export type ParsedInfoForCollectionSettings =
    ParsedYamlMapWithKeyAndValueRange<{
        name?: WithKeyAndValueRange<string>;
    }>;

export type ParsedEnvironmentVariable = ParsedYamlMapWithValueRange<{
    name?: WithKeyAndValueRange<string>;
    value?:
        | WithKeyAndValueRange<string>
        | ({
              keyRange: Range;
          } & ParsedYamlMap<{
              type?: WithKeyAndValueRange<VariableType>;
              data?: WithKeyAndValueRange<string>;
          }>);
    description?: WithKeyAndValueRange<string>;
    type: OptionalVariableFieldResult<VariableType>;
    secret: OptionalVariableFieldResult<boolean>;
    disabled: OptionalVariableFieldResult<boolean>;
}>;

export interface WithKeyAndValueRange<T> {
    keyRange: Range;
    value: T;
    valueRange: Range;
}

export interface YamlMapMissingPropertyInfo {
    key: string;
    isMandatory: boolean;
    alwaysHasScalarValue: boolean;
}

export type {
    EnabledAndDisabledItems,
    ParsedRequestHeader,
} from "../../internal/yamlFormat/interfaces";
