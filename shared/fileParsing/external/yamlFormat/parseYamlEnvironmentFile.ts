import { YAMLMap } from "yaml";
import {
    ParsedEnvironmentVariable,
    TextDocumentHelper,
    WithKeyAndValueRange,
    YamlParsingError,
    YamlParsingOptions,
} from "../../..";
import { getYamlMapsFromSequence } from "../../internal/yamlFormat/yamlSequences/getYamlMapsFromSequence";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedYamlMap,
} from "../../internal/yamlFormat/interfaces";
import { getRangeForItem } from "../../internal/yamlFormat/util/getRangeForItem";
import { getValidatedMapItems } from "../../internal/yamlFormat/yamlMaps/getValidatedMapItems";
import { parseDocumentIntoYamlMap } from "../../internal/yamlFormat/util/parseDocumentIntoYamlMap";
import { stripKeyFromResult } from "../../internal/yamlFormat/util/stripKeyFromResult";
import { getValueFieldFromVariable } from "../../internal/yamlFormat/brunoSpecific/getValueFieldFromVariable";
import {
    EnvironmentVariableProperty,
    TopLevelEnvironmentFileProperty,
} from "./constants/environmentFileConstants";
import { VariableType } from "./constants/sharedConstants";

export function parseYamlEnvironmentFile(
    docHelper: TextDocumentHelper,
    options?: YamlParsingOptions,
): MaybeResultWithErrors<
    ParsedYamlMap<{
        name?: WithKeyAndValueRange<string>;
        extends?: WithKeyAndValueRange<string>;
        variables?: {
            enabled: ParsedEnvironmentVariable[];
            disabled: ParsedEnvironmentVariable[];
        };
    }>
> {
    const fullDocumentRange = docHelper.getTextRange();
    const commonArgs: CommonParsingArgs = {
        docHelper,
        fullDocumentRange,
        mapDescriptors: options?.mapDescriptors,
    };
    const collectedErrors: YamlParsingError[] = [];

    const maybeTopLevelMap = parseDocumentIntoYamlMap(commonArgs);
    if ("errors" in maybeTopLevelMap) {
        return maybeTopLevelMap;
    }
    const topLevelMap = maybeTopLevelMap.map;

    const { getString, getSequence } = getValidatedMapItems(
        topLevelMap,
        {
            scalars: {
                stringValues: [
                    TopLevelEnvironmentFileProperty.Name,
                    TopLevelEnvironmentFileProperty.Extends,
                ],
            },
            sequenceValues: [TopLevelEnvironmentFileProperty.Variables],
            mandatoryKeys: [TopLevelEnvironmentFileProperty.Name],
        },
        commonArgs,
        collectedErrors,
    );

    const maybeNameWithKeyRange = getString(
        TopLevelEnvironmentFileProperty.Name,
    );
    const maybeExtendsWithKeyRange = getString(
        TopLevelEnvironmentFileProperty.Extends,
    );
    const variablesSequence = getSequence(
        TopLevelEnvironmentFileProperty.Variables,
    )?.value;

    if (!variablesSequence) {
        // For further steps, the variables sequence needs to be valid.
        return {
            errors: collectedErrors,
            result: {
                properties: {
                    name: maybeNameWithKeyRange,
                    extends: maybeExtendsWithKeyRange,
                },
            },
        };
    }

    const { items: variableItems, errors: firstErrorBatch } =
        getYamlMapsFromSequence({
            ...commonArgs,
            sequence: variablesSequence,
        });
    const { variables, errors: secondErrorBatch } = getVariablesFromMapItems(
        variableItems,
        commonArgs,
    );

    return {
        result: {
            properties: {
                name: maybeNameWithKeyRange,
                extends: maybeExtendsWithKeyRange,
                variables,
            },
        },
        errors: collectedErrors.concat(firstErrorBatch, secondErrorBatch),
    };
}

function getVariablesFromMapItems(
    items: YAMLMap[],
    commonArgs: CommonParsingArgs,
): {
    variables: {
        enabled: ParsedEnvironmentVariable[];
        disabled: ParsedEnvironmentVariable[];
    };
    errors: YamlParsingError[];
} {
    const enabledVariables: ParsedEnvironmentVariable[] = [];
    const disabledVariables: ParsedEnvironmentVariable[] = [];
    const errors: YamlParsingError[] = [];

    const keysForStringScalars = [
        EnvironmentVariableProperty.Description,
        EnvironmentVariableProperty.Name,
    ];
    const keysForBooleanScalars = [
        EnvironmentVariableProperty.Disabled,
        EnvironmentVariableProperty.Secret,
    ];

    for (const currentMap of items) {
        const { getString, getBoolean, getEnumValue } = getValidatedMapItems(
            currentMap,
            {
                scalars: {
                    stringValues: keysForStringScalars,
                    booleanValues: keysForBooleanScalars,
                    enumValues: {
                        [EnvironmentVariableProperty.Type]:
                            Object.values(VariableType),
                    },
                },
                mandatoryKeys: [EnvironmentVariableProperty.Name],
                // The value gets parsed separately, because it can be either a scalar or a map.
                additionalAllowedKeys: [
                    {
                        key: EnvironmentVariableProperty.Value,
                        valueKinds: ["string", "map"],
                    },
                ],
            },
            commonArgs,
            errors,
        );
        const disabled = getBoolean(EnvironmentVariableProperty.Disabled);
        const secret = getBoolean(EnvironmentVariableProperty.Secret);

        const type = getEnumValue<VariableType>(
            EnvironmentVariableProperty.Type,
        );
        const { result: maybeValue, errors: valueErrors } =
            getValueFieldFromVariable(currentMap, commonArgs);
        errors.push(...valueErrors);

        const variable: ParsedEnvironmentVariable = {
            valueRange: getRangeForItem(currentMap, commonArgs),
            properties: {
                name: stripKeyFromResult(
                    getString(EnvironmentVariableProperty.Name),
                ),
                description: stripKeyFromResult(
                    getString(EnvironmentVariableProperty.Description),
                ),
                disabled: disabled
                    ? {
                          effectiveValue: disabled.value,
                          field: stripKeyFromResult(disabled),
                      }
                    : // The default value for 'disabled' is false, when not defined.
                      { effectiveValue: false },
                secret: secret
                    ? {
                          effectiveValue: secret.value,
                          field: stripKeyFromResult(secret),
                      }
                    : // The default value for 'secret' is false, when not defined.
                      { effectiveValue: false },
                value: maybeValue,
                type: type
                    ? {
                          effectiveValue: type.value,
                          field: type,
                      }
                    : // The default value for 'type' is 'string', when not defined.
                      { effectiveValue: VariableType.String },
            },
        };

        if (variable.properties.disabled.effectiveValue) {
            disabledVariables.push(variable);
        } else {
            enabledVariables.push(variable);
        }
    }

    return {
        variables: { enabled: enabledVariables, disabled: disabledVariables },
        errors,
    };
}
