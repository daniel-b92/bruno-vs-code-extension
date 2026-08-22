import { YAMLMap, YAMLSeq } from "yaml";
import {
    Range,
    TextDocumentHelper,
    WithKeyAndValueRange,
    YamlParsingError,
} from "../../..";
import {
    ActionPhase,
    ActionSelectorMethod,
    ActionType,
    ActionVariableScope,
} from "../../external/yamlFormat/constants/actionConstants";
import { AuthType } from "../../external/yamlFormat/constants/authConstants";
import {
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
        withUnknownValue: WithKeyKeyRangeAndValueRange<unknown>[];
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
        | ParseYamlMapWithKeyAndValueRange<{
              type?: WithKeyAndValueRange<VariableType>;
              data?: WithKeyAndValueRange<string>;
          }>;
    description?: WithKeyAndValueRange<string>;
    disabled: OptionalVariableFieldResult<boolean>;
}>;

export type ParsedAction = ParsedYamlMapWithValueRange<{
    type?: WithKeyAndValueRange<ActionType>;
    phase?: WithKeyAndValueRange<ActionPhase>;
    selector?: ParseYamlMapWithKeyAndValueRange<{
        expression?: WithKeyAndValueRange<string>;
        method?: WithKeyAndValueRange<ActionSelectorMethod>;
    }>;
    variable?: ParseYamlMapWithKeyAndValueRange<{
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

export type ParsedDocsWithType = WithKeyAndValueRange<
    | string
    | ParsedYamlMap<{
          type?: WithKeyAndValueRange<DocsType>;
          content?: WithKeyAndValueRange<string>;
      }>
>;

export type ParsedAuth = WithKeyAndValueRange<
    ParsedInheritAuth | ParsedBasicAuth | ParsedBearerAuth
>;

export type ParsedBasicAuth = ParsedYamlMap<{
    type: WithKeyAndValueRange<AuthType.Basic>;
    username?: WithKeyAndValueRange<string>;
    password?: WithKeyAndValueRange<string>;
}>;

export type ParsedBearerAuth = ParsedYamlMap<{
    type: WithKeyAndValueRange<AuthType.Bearer>;
    token?: WithKeyAndValueRange<string>;
}>;

export interface ParsedInheritAuth {
    valueRange: Range;
}

export type ParseYamlMapWithKeyAndValueRange<T> =
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

export interface YamlMapMissingPropertyInfo {
    key: string;
    isMandatory: boolean;
    alwaysHasScalarValue: boolean;
}

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
