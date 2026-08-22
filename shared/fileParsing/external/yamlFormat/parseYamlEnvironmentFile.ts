import { YAMLMap } from "yaml";
import {
    ParsedEnvironmentVariable,
    TextDocumentHelper,
    TopLevelEnvironmentFileProperty,
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
import { getMapItems } from "../../internal/yamlFormat/yamlMaps/getMapItems";
import { getErrorForMissingKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForMissingKeyInMap";
import { getErrorForUnknownKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForUnknownKeyInMap";
import { parseDocumentIntoYamlMap } from "../../internal/yamlFormat/util/parseDocumentIntoYamlMap";
import { getTypedValueFromList } from "../../internal/yamlFormat/scalars/getTypedValueFromList";
import { stripKeyFromResult } from "../../internal/yamlFormat/util/stripKeyFromResult";
import { getValueFieldFromVariable } from "../../internal/yamlFormat/brunoSpecific/getValueFieldFromVariable";
import { EnvironmentVariableProperty } from "../../internal/yamlFormat/brunoSpecific/constants/environmentVariableConstants";
import { VariableType } from "../../internal/yamlFormat/brunoSpecific/constants/sharedConstants";

export function parseYamlEnvironmentFile(
    docHelper: TextDocumentHelper,
): MaybeResultWithErrors<
    ParsedYamlMap<{
        name?: WithKeyAndValueRange<string>;
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

    const mandatoryKey = TopLevelEnvironmentFileProperty.Name;
    const keysForStringScalars = [TopLevelEnvironmentFileProperty.Name];
    const keysForSequences = [TopLevelEnvironmentFileProperty.Variables];

    const {
        items: {
            validScalars: { withStringValue: validStringScalars },
            validSequences,
            missingKeys,
            unknownKeys,
        },
        errors: mapItemErrors,
    } = getMapItems(
        topLevelMap,
        {
            scalars: { stringValues: keysForStringScalars },
            sequenceValues: keysForSequences,
        },
        commonArgs,
    );

    collectedErrors.push(
        ...mapItemErrors.concat(
            unknownKeys.map(({ key, keyRange }) =>
                getErrorForUnknownKeyInMap({
                    ...commonArgs,
                    unknownKey: key,
                    keyRange,
                    allowedKeys: keysForStringScalars.concat(keysForSequences),
                }),
            ),
            missingKeys.includes(mandatoryKey)
                ? getErrorForMissingKeyInMap({
                      ...commonArgs,
                      missingKey: mandatoryKey,
                      map: topLevelMap,
                  })
                : [],
        ),
    );
    const missingProperties = missingKeys.map((key) => ({
        alwaysHasScalarValue: (keysForStringScalars as string[]).includes(key),
        isMandatory: key == mandatoryKey,
        key,
    }));

    const maybeNameWithKeyRange = validStringScalars.find(
        ({ key }) => key == TopLevelEnvironmentFileProperty.Name,
    );
    const variablesSequence = validSequences.find(
        ({ key }) => key == TopLevelEnvironmentFileProperty.Variables,
    )?.value;

    if (!variablesSequence) {
        // For further steps, the variables sequence needs to be valid.
        return {
            errors: collectedErrors,
            result: {
                properties: { name: maybeNameWithKeyRange },
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
    const mandatoryKey = EnvironmentVariableProperty.Name;

    for (const currentMap of items) {
        const { items: allMapItems, errors: mapItemErrors } = getMapItems(
            currentMap,
            {
                scalars: {
                    stringValues: keysForStringScalars,
                    booleanValues: keysForBooleanScalars,
                },
                sequenceValues: [],
            },
            commonArgs,
        );

        errors.push(
            ...mapItemErrors.concat(
                allMapItems.unknownKeys
                    .filter(
                        ({ key }) =>
                            !(
                                Object.values(
                                    EnvironmentVariableProperty,
                                ) as string[]
                            ).includes(key),
                    )
                    .map(({ key, keyRange }) =>
                        getErrorForUnknownKeyInMap({
                            ...commonArgs,
                            unknownKey: key,
                            keyRange,
                            allowedKeys: keysForStringScalars.concat(
                                keysForBooleanScalars,
                            ),
                        }),
                    ),
                allMapItems.missingKeys.includes(mandatoryKey)
                    ? getErrorForMissingKeyInMap({
                          ...commonArgs,
                          missingKey: mandatoryKey,
                          map: currentMap,
                      })
                    : [],
            ),
        );
        const missingProperties = allMapItems.missingKeys.map((key) => ({
            key,
            alwaysHasScalarValue: true,
            isMandatory: key == mandatoryKey,
        }));
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
