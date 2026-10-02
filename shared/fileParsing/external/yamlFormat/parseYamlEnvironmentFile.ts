import { YAMLMap } from "yaml";
import {
    ParsedEnvironmentVariable,
    TextDocumentHelper,
    WithKeyAndValueRange,
    YamlParsingError,
} from "../../..";
import { getYamlMapsFromSequence } from "../../internal/yamlFormat/yamlSequences/getYamlMapsFromSequence";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedMapItems,
    ParsedYamlMap,
} from "../../internal/yamlFormat/interfaces";
import { getRangeForItem } from "../../internal/yamlFormat/util/getRangeForItem";
import { getValidatedMapItems } from "../../internal/yamlFormat/yamlMaps/getValidatedMapItems";
import { parseDocumentIntoYamlMap } from "../../internal/yamlFormat/util/parseDocumentIntoYamlMap";
import { getTypedValueFromList } from "../../internal/yamlFormat/scalars/getTypedValueFromList";
import { stripKeyFromResult } from "../../internal/yamlFormat/util/stripKeyFromResult";
import { getValueFieldFromVariable } from "../../internal/yamlFormat/brunoSpecific/getValueFieldFromVariable";
import {
    EnvironmentVariableProperty,
    TopLevelEnvironmentFileProperty,
} from "./constants/environmentFileConstants";
import { VariableType } from "./constants/sharedConstants";

export function parseYamlEnvironmentFile(
    docHelper: TextDocumentHelper,
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
    const commonArgs = { docHelper, fullDocumentRange };
    const collectedErrors: YamlParsingError[] = [];

    const maybeTopLevelMap = parseDocumentIntoYamlMap(commonArgs);
    if ("errors" in maybeTopLevelMap) {
        return maybeTopLevelMap;
    }
    const topLevelMap = maybeTopLevelMap.map;

    const {
        items: {
            validScalars: { withStringValue: validStringScalars },
            validSequences,
        },
        missingProperties,
    } = getValidatedMapItems(
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

    const maybeNameWithKeyRange = validStringScalars.find(
        ({ key }) => key == TopLevelEnvironmentFileProperty.Name,
    );
    const maybeExtendsWithKeyRange = validStringScalars.find(
        ({ key }) => key == TopLevelEnvironmentFileProperty.Extends,
    );
    const variablesSequence = validSequences.find(
        ({ key }) => key == TopLevelEnvironmentFileProperty.Variables,
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
                missingProperties,
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
            missingProperties,
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
        EnvironmentVariableProperty.Type,
    ];
    const keysForBooleanScalars = [
        EnvironmentVariableProperty.Disabled,
        EnvironmentVariableProperty.Secret,
    ];

    for (const currentMap of items) {
        const { items: allMapItems, missingProperties } = getValidatedMapItems(
            currentMap,
            {
                scalars: {
                    stringValues: keysForStringScalars,
                    booleanValues: keysForBooleanScalars,
                },
                mandatoryKeys: [EnvironmentVariableProperty.Name],
                // The value gets parsed separately, because it can be either a scalar or a map.
                additionalAllowedKeys: [EnvironmentVariableProperty.Value],
            },
            commonArgs,
            errors,
        );
        const { description, disabled, secret } =
            getItemsForSimpleOptionalVariableProps(allMapItems);

        const type = getTypedValueFromList(
            {
                allStringValues: allMapItems.validScalars.withStringValue,
                allowedValues: Object.values(VariableType),
                keyName: EnvironmentVariableProperty.Type,
            },
            errors,
        );
        const { result: maybeValue, errors: valueErrors } =
            getValueFieldFromVariable(currentMap, commonArgs);
        errors.push(...valueErrors);

        const name = allMapItems.validScalars.withStringValue.find(
            ({ key }) => key == EnvironmentVariableProperty.Name,
        );

        const variable: ParsedEnvironmentVariable = {
            valueRange: getRangeForItem(currentMap, commonArgs),
            missingProperties,
            properties: {
                name: name ? stripKeyFromResult(name) : undefined,
                description: description
                    ? stripKeyFromResult(description)
                    : undefined,
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
                          effectiveValue: type.value.value,
                          field: type.value,
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

function getItemsForSimpleOptionalVariableProps(allMapItems: ParsedMapItems) {
    const maybeDescriptionWithKeyRange =
        allMapItems.validScalars.withStringValue.find(
            ({ key }) => key == EnvironmentVariableProperty.Description,
        );

    const maybeDisabledWithKeyRange =
        allMapItems.validScalars.withBooleanValue.find(
            ({ key }) => key == EnvironmentVariableProperty.Disabled,
        );

    const maybeSecretWithKeyRange =
        allMapItems.validScalars.withBooleanValue.find(
            ({ key }) => key == EnvironmentVariableProperty.Secret,
        );

    return {
        description: maybeDescriptionWithKeyRange,
        disabled: maybeDisabledWithKeyRange,
        secret: maybeSecretWithKeyRange,
    };
}
