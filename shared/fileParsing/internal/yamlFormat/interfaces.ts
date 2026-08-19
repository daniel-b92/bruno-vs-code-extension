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
} from "./brunoSpecific/constants/actionConstants";
import { AuthType } from "./brunoSpecific/constants/authConstants";
import {
    DocsType,
    ScriptType,
    VariableType,
} from "./brunoSpecific/constants/sharedConstants";

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

export type ParsedRequestVariable = ParsedYamlMap<{
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
    disabled: OptionalVariableFieldResult<boolean>;
}>;

export type ParsedAction = ParsedYamlMap<{
    type?: WithKeyAndValueRange<ActionType>;
    phase?: WithKeyAndValueRange<ActionPhase>;
    selector?: ParsedYamlMap<{
        expression?: WithKeyAndValueRange<string>;
        method?: WithKeyAndValueRange<ActionSelectorMethod>;
    }>;
    variable?: ParsedYamlMap<{
        name?: WithKeyAndValueRange<string>;
        scope?: WithKeyAndValueRange<ActionVariableScope>;
    }>;
    description?: WithKeyAndValueRange<string>;
    disabled: OptionalVariableFieldResult<boolean>;
}>;

export type ParsedRequestHeader = ParsedYamlMap<{
    name?: WithKeyAndValueRange<string>;
    value?: WithKeyAndValueRange<string>;
    description?: WithKeyAndValueRange<string>;
    disabled: OptionalVariableFieldResult<boolean>;
}>;

export type ParsedScript = ParsedYamlMap<{
    type?: WithKeyAndValueRange<ScriptType>;
    code?: WithKeyAndValueRange<string>;
}>;

export type ParsedDocsWithType =
    | WithKeyAndValueRange<string>
    | ParsedYamlMap<{
          type?: WithKeyAndValueRange<DocsType>;
          content?: WithKeyAndValueRange<string>;
      }>;

export type ParsedAuth = ParsedInheritAuth | ParsedBasicAuth | ParsedBearerAuth;

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

export type ParsedYamlMap<T> = {
    properties: T;
    missingProperties: {
        key: string;
        isMandatory: boolean;
        hasScalarValue: boolean;
    }[];
};

export type ParsingResult<T> =
    | YamlParsingError[]
    | {
          result: T;
          errors: YamlParsingError[];
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
