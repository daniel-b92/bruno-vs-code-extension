import { isMap, isScalar, Scalar, YAMLMap } from "yaml";
import { Range, TextDocumentHelper, YamlParsingError } from "../../..";
import { getYamlMapsFromSequence } from "../../internal/yamlFormat/yamlSequences/getYamlMapsFromSequence";
import {
    CommonParsingArgs,
    EnvironmentVariableProperty,
    ParsedEnvironmentVariable,
    ParsedMapItems,
    VariableType,
    WithKeyAndValueRange,
} from "../../internal/yamlFormat/interfaces";
import { getRangeForItem } from "../../internal/yamlFormat/util/getRangeForItem";
import { getMapItems } from "../../internal/yamlFormat/yamlMaps/getMapItems";
import { getErrorForValueWithUnexpectedType } from "../../internal/yamlFormat/parsingErrors/getErrorForValueWithUnexpectedType";
import { getRangeForUnknownYamlItem } from "../../internal/yamlFormat/util/getRangeForUnknownYamlItem";
import { getErrorForMissingKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForMissingKeyInMap";
import { mapFromYamlScalar } from "../../internal/yamlFormat/scalars/mapFromYamlScalar";
import { getErrorForUnknownKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForUnknownKeyInMap";
import { parseDocumentIntoYamlMap } from "../../internal/yamlFormat/util/parseDocumentIntoYamlMap";
import { getTypedScalarFromList } from "../../internal/yamlFormat/scalars/getTypedScalarFromList";

enum EnvironmentKeyName {
    Name = "name",
    Variables = "variables",
}

enum VariableValueWithTypeProperty {
    Type = "type",
    Data = "data",
}

export function parseYamlEnvironmentFile(docHelper: TextDocumentHelper):
    | YamlParsingError[]
    | {
          name: WithKeyAndValueRange<string> | { missing: boolean };
          variables: ParsedEnvironmentVariable[];
          errors: YamlParsingError[];
      } {
    const fullDocumentRange = docHelper.getTextRange();
    const commonArgs = { docHelper, fullDocumentRange };
    const collectedErrors: YamlParsingError[] = [];

    const maybeTopLevelMap = parseDocumentIntoYamlMap(commonArgs);
    if ("errors" in maybeTopLevelMap) {
        return maybeTopLevelMap.errors;
    }
    const topLevelMap = maybeTopLevelMap.map;

    const keysForStringScalars = [EnvironmentKeyName.Name];
    const keysForSequences = [EnvironmentKeyName.Variables];

    const { items: mapItems, errors: mapItemErrors } = getMapItems(
        topLevelMap,
        {
            scalars: { stringValues: keysForStringScalars },
            sequenceValues: keysForSequences,
        },
        commonArgs,
    );

    collectedErrors.push(
        ...mapItemErrors.concat(
            mapItems.unknownKeys.map(({ key, keyRange }) =>
                getErrorForUnknownKeyInMap({
                    ...commonArgs,
                    unknownKey: key,
                    keyRange,
                    allowedKeys: keysForStringScalars.concat(keysForSequences),
                }),
            ),
        ),
    );

    const {
        validScalars: { withStringValue: validStringScalars },
        validSequences,
        missingKeys,
    } = mapItems;

    const maybeNameWithKeyRange = validStringScalars.find(
        ({ key }) => key == EnvironmentKeyName.Name,
    );
    let nameToUse: WithKeyAndValueRange<string> | { missing: boolean } = {
        missing: missingKeys.includes(EnvironmentKeyName.Name),
    };
    if (maybeNameWithKeyRange) {
        nameToUse = mapFromYamlScalar({
            ...commonArgs,
            ...maybeNameWithKeyRange,
        });
    }

    const variablesSequence = validSequences.find(
        ({ key }) => key == EnvironmentKeyName.Variables,
    )?.value;

    if (!variablesSequence) {
        // For further steps, the variables sequence needs to be valid.
        return collectedErrors;
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
        name: nameToUse,
        variables,
        errors: collectedErrors.concat(firstErrorBatch, secondErrorBatch),
    };
}

function getVariablesFromMapItems(
    items: YAMLMap<unknown, unknown>[],
    commonArgs: CommonParsingArgs,
): { variables: ParsedEnvironmentVariable[]; errors: YamlParsingError[] } {
    const variables: ParsedEnvironmentVariable[] = [];
    const errors: YamlParsingError[] = [];

    for (const currentMap of items) {
        const commonParams = {
            ...commonArgs,
            map: currentMap,
            isTopLevelMap: false,
        };

        const keysForStringScalars = [
            EnvironmentVariableProperty.Description,
            EnvironmentVariableProperty.Name,
            EnvironmentVariableProperty.Type,
        ];
        const keysForBooleanScalars = [
            EnvironmentVariableProperty.Disabled,
            EnvironmentVariableProperty.Secret,
        ];

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
            ),
        );
        const {
            description: descriptionWithKeyRange,
            disabled: disabledWithKeyRange,
            secret: secretWithKeyRange,
        } = getItemsForSimpleOptionalVariableProps(allMapItems);

        const type = getTypedScalarFromList(
            {
                commonParsingArgs: commonArgs,
                allStringScalars: allMapItems.validScalars.withStringValue,
                allowedValues: Object.values(VariableType),
                keyName: EnvironmentVariableProperty.Type,
            },
            errors,
        );
        const maybeValue = getValueFieldFromVariable(commonParams);
        if (maybeValue && "errors" in maybeValue) {
            errors.push(...maybeValue.errors);
        }

        const valueToUse =
            maybeValue && !("errors" in maybeValue) ? maybeValue : undefined;

        const nameWithKeyRange = allMapItems.validScalars.withStringValue.find(
            ({ key }) => key == EnvironmentVariableProperty.Name,
        );

        if (!nameWithKeyRange) {
            // The 'name' field is the only one that always has to be present.
            errors.push(
                getErrorForMissingKeyInMap({
                    ...commonArgs,
                    missingKey: EnvironmentVariableProperty.Name,
                    map: currentMap,
                }),
            );
            continue;
        }

        variables.push({
            range: getRangeForItem(currentMap, commonArgs),
            missingProperties:
                allMapItems.missingKeys as EnvironmentVariableProperty[],
            fields: {
                name: mapFromYamlScalar({ ...commonArgs, ...nameWithKeyRange }),
                description: descriptionWithKeyRange
                    ? mapFromYamlScalar({
                          ...commonArgs,
                          ...descriptionWithKeyRange,
                      })
                    : undefined,
                disabled: disabledWithKeyRange
                    ? {
                          effectiveValue: disabledWithKeyRange.value.value,
                          field: mapFromYamlScalar({
                              ...commonArgs,
                              ...disabledWithKeyRange,
                          }),
                      }
                    : // The default value for 'disabled' is false, when not defined.
                      { effectiveValue: false },
                secret: secretWithKeyRange
                    ? {
                          effectiveValue: secretWithKeyRange.value.value,
                          field: mapFromYamlScalar({
                              ...commonArgs,
                              ...secretWithKeyRange,
                          }),
                      }
                    : // The default value for 'secret' is false, when not defined.
                      { effectiveValue: false },
                value: !valueToUse
                    ? undefined
                    : isScalar<string>(valueToUse.value)
                      ? mapFromYamlScalar({
                            ...commonArgs,
                            keyRange: valueToUse.keyRange,
                            value: valueToUse.value,
                        })
                      : {
                            ...valueToUse,
                            ...valueToUse.value,
                        },
                type: type
                    ? {
                          effectiveValue: type.value.value,
                          field: type.value,
                      }
                    : // The default value for 'type' is 'string', when not defined.
                      { effectiveValue: VariableType.String },
            },
        });
    }

    return { variables, errors };
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

function getValueFieldFromVariable(commonParams: {
    map: YAMLMap<unknown, unknown>;
    isTopLevelMap: boolean;
    docHelper: TextDocumentHelper;
    fullDocumentRange: Range;
}):
    | {
          keyRange: Range;
          value:
              | { valueRange: Range; value: string }
              | {
                    data: WithKeyAndValueRange<string>;
                    type: WithKeyAndValueRange<VariableType>;
                };
      }
    | { errors: YamlParsingError[] }
    | undefined {
    const { map: variableDefinitionMap, fullDocumentRange } = commonParams;

    const matchingField = variableDefinitionMap.items.find(
        ({ key }) =>
            isScalar<string>(key) &&
            key.value == EnvironmentVariableProperty.Value,
    );

    if (!matchingField) {
        // Field is optional. Is not necessarily an error, if it's missing.
        return undefined;
    }

    const keyRange = getRangeForItem(
        matchingField.key as Scalar<string>,
        commonParams,
    );

    if (!isMap(matchingField.value)) {
        const maybeTypedValue:
            { item: Scalar<string> } | { error: YamlParsingError } =
            isScalar<string>(matchingField.value)
                ? { item: matchingField.value }
                : {
                      error: getErrorForValueWithUnexpectedType({
                          ...commonParams,
                          key: EnvironmentVariableProperty.Value,
                          expectedType: "Scalar",
                          valueRange: (getRangeForUnknownYamlItem(
                              matchingField.value,
                          ) ?? fullDocumentRange) as Range,
                      }),
                  };

        return "error" in maybeTypedValue
            ? { errors: [maybeTypedValue.error] }
            : {
                  keyRange,
                  value: {
                      value: maybeTypedValue.item.value,
                      valueRange: getRangeForItem(
                          maybeTypedValue.item,
                          commonParams,
                      ),
                  },
              };
    }

    const collectedErrors: YamlParsingError[] = [];
    const valueMapItem = matchingField.value;
    const keysForStringScalars = [
        VariableValueWithTypeProperty.Data,
        VariableValueWithTypeProperty.Type,
    ];

    const { items: valueMapItems, errors: mapItemErrors } = getMapItems(
        valueMapItem,
        {
            scalars: {
                stringValues: keysForStringScalars,
            },
            sequenceValues: [],
        },
        commonParams,
    );

    const {
        missingKeys,
        unknownKeys,
        validScalars: { withStringValue: validStringScalars },
    } = valueMapItems;
    collectedErrors.push(
        ...mapItemErrors.concat(
            unknownKeys.map(({ key, keyRange }) =>
                getErrorForUnknownKeyInMap({
                    ...commonParams,
                    unknownKey: key,
                    keyRange,
                    allowedKeys: keysForStringScalars,
                }),
            ),
            missingKeys.map((key) =>
                getErrorForMissingKeyInMap({
                    ...commonParams,
                    missingKey: key,
                    map: valueMapItem,
                }),
            ),
        ),
    );

    const maybeDataItem = validStringScalars.find(
        ({ key }) => key == VariableValueWithTypeProperty.Data,
    );
    const data: WithKeyAndValueRange<string> | undefined = maybeDataItem
        ? {
              keyRange: maybeDataItem.keyRange,
              value: maybeDataItem.value.value,
              valueRange: getRangeForItem(maybeDataItem.value, commonParams),
          }
        : undefined;

    const maybeType = getTypedScalarFromList(
        {
            commonParsingArgs: commonParams,
            allowedValues: Object.values(VariableType),
            allStringScalars: validStringScalars,
            keyName: VariableValueWithTypeProperty.Type,
        },
        collectedErrors,
    );

    return collectedErrors.length > 0 || !data || !maybeType
        ? { errors: collectedErrors }
        : {
              keyRange,
              value: {
                  data,
                  type: maybeType.value,
              },
          };
}
