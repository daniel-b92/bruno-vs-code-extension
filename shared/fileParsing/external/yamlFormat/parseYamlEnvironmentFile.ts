import {
    isMap,
    isScalar,
    LineCounter,
    parseDocument,
    Scalar,
    YAMLMap,
} from "yaml";
import {
    ParsedEnvironmentVariable,
    Range,
    TextDocumentHelper,
    VariableType,
    WithKeyAndValueRange,
    YamlParsingError,
    YamlParsingErrorCode,
} from "../../..";
import { mapErrors } from "../../internal/yamlFormat/parsingErrors/mapErrors";
import { getTopLevelMapIfExists } from "../../internal/yamlFormat/yamlMaps/getTopLevelMapIfExists";
import { getYamlMapsFromSequence } from "../../internal/yamlFormat/yamlSequences/getYamlMapsFromSequence";
import {
    CommonParsingArgs,
    ParsedMapItems,
} from "../../internal/yamlFormat/interfaces";
import { getRangeForItem } from "../../internal/yamlFormat/util/getRangeForItem";
import { getMapItems } from "../../internal/yamlFormat/yamlMaps/getMapItems";
import { getErrorForValueWithUnexpectedType } from "../../internal/yamlFormat/parsingErrors/getErrorForValueWithUnexpectedType";
import { getRangeForUnknownYamlItem } from "../../internal/yamlFormat/util/getRangeForUnknownYamlItem";
import { getErrorForMissingKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForMissingKeyInMap";
import { mapFromYamlScalar } from "../../internal/yamlFormat/util/mapFromYamlScalar";
import { getErrorForUnknownKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForUnknownKeyInMap";
import { getImplicitErrorsForAllInvalidMapItems } from "../../internal/yamlFormat/yamlMaps/getImplicitErrorsForAllInvalidMapItems";

enum EnvironmentKeyName {
    Name = "name",
    Variables = "variables",
}

enum VariableProperty {
    Name = "name",
    Value = "value",
    Description = "description",
    Disabled = "disabled",
    Secret = "secret",
    Type = "type",
}

enum VariableValueWithTypeProperty {
    Type = "type",
    Data = "data",
}

export function parseYamlEnvironmentFile(docHelper: TextDocumentHelper):
    | YamlParsingError[]
    | {
          name?: WithKeyAndValueRange<string>;
          variables: ParsedEnvironmentVariable[];
          errors: YamlParsingError[];
      } {
    const document = parseDocument(docHelper.getText(), {
        lineCounter: new LineCounter(),
    });
    const fullDocumentRange = docHelper.getTextRange();
    const commonArgs = { docHelper, fullDocumentRange };
    const collectedErrors: YamlParsingError[] = [];

    if (document.errors.length > 0) {
        // Cannot continue with a technical parsing error.
        return mapErrors(document.errors, fullDocumentRange);
    }

    const maybeTopLevelMap = getTopLevelMapIfExists({
        ...commonArgs,
        node: document.contents,
    });
    if ("error" in maybeTopLevelMap) {
        // Cannot continue, if the top level map is not valid.
        return [maybeTopLevelMap.error];
    }
    const { map: topLevelMap } = maybeTopLevelMap;

    const { items: mapItems, errors: mapItemErrors } = getMapItems(
        topLevelMap,
        {
            scalars: { stringValues: [EnvironmentKeyName.Name] },
            sequenceValues: [EnvironmentKeyName.Variables],
        },
        commonArgs,
    );

    collectedErrors.push(
        ...mapItemErrors
            .concat(
                getImplicitErrorsForAllInvalidMapItems(mapItems, commonArgs),
            )
            .concat(
                mapItems.unknownKeys.map(({ key, keyRange }) =>
                    getErrorForUnknownKeyInMap({
                        ...commonArgs,
                        unknownKey: key,
                        keyRange,
                    }),
                ),
            ),
    );

    const {
        validScalars: { withStringValue: validStringScalars },
        validSequences,
    } = mapItems;

    const maybeNameWithKeyRange = validStringScalars.find(
        ({ key }) => key == EnvironmentKeyName.Name,
    );
    let nameToUse: WithKeyAndValueRange<string> | undefined = undefined;
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

        const { items: allMapItems, errors: mapItemErrors } = getMapItems(
            currentMap,
            {
                scalars: {
                    stringValues: [
                        VariableProperty.Description,
                        VariableProperty.Name,
                        VariableProperty.Type,
                    ],
                    booleanValues: [
                        VariableProperty.Disabled,
                        VariableProperty.Secret,
                    ],
                },
                sequenceValues: [],
            },
            commonArgs,
        );

        errors.push(
            ...mapItemErrors
                .concat(
                    getImplicitErrorsForAllInvalidMapItems(
                        allMapItems,
                        commonArgs,
                    ),
                )
                .concat(
                    allMapItems.unknownKeys
                        .filter(
                            ({ key }) =>
                                !(
                                    Object.values(VariableProperty) as string[]
                                ).includes(key),
                        )
                        .map(({ key, keyRange }) =>
                            getErrorForUnknownKeyInMap({
                                ...commonArgs,
                                unknownKey: key,
                                keyRange,
                            }),
                        ),
                ),
        );
        const {
            description: descriptionWithKeyRange,
            disabled: disabledWithKeyRange,
            secret: secretWithKeyRange,
        } = getItemsForSimpleOptionalVariableProps(allMapItems);

        const type = getItemVariableTypeScalarField(
            allMapItems,
            commonArgs,
            errors,
        );
        const maybeValue = getValueFieldFromVariable(commonParams);
        if (maybeValue && "errors" in maybeValue) {
            errors.push(...maybeValue.errors);
        }

        const valueToUse =
            maybeValue && !("errors" in maybeValue) ? maybeValue : undefined;

        const nameWithKeyRange = allMapItems.validScalars.withStringValue.find(
            ({ key }) => key == VariableProperty.Name,
        );

        if (!nameWithKeyRange) {
            // The 'name' field is the only one that always has to be present.
            errors.push(
                getErrorForMissingKeyInMap({
                    ...commonArgs,
                    missingKey: VariableProperty.Name,
                    map: currentMap,
                }),
            );
            continue;
        }

        variables.push({
            name: mapFromYamlScalar({ ...commonArgs, ...nameWithKeyRange }),
            description: descriptionWithKeyRange
                ? mapFromYamlScalar({
                      ...commonArgs,
                      ...descriptionWithKeyRange,
                  })
                : undefined,
            disabled: disabledWithKeyRange
                ? mapFromYamlScalar({
                      ...commonArgs,
                      ...disabledWithKeyRange,
                  })
                : undefined,
            secret: secretWithKeyRange
                ? mapFromYamlScalar({
                      ...commonArgs,
                      ...secretWithKeyRange,
                  })
                : undefined,
            value: !valueToUse
                ? undefined
                : isScalar<string>(valueToUse.value)
                  ? mapFromYamlScalar({
                        ...commonArgs,
                        keyRange: valueToUse.keyRange,
                        value: valueToUse.value,
                    })
                  : {
                        data: mapFromYamlScalar({
                            ...commonArgs,
                            keyRange: valueToUse.value.data.keyRange,
                            value: valueToUse.value.data.scalar,
                        }),
                        type: mapFromYamlScalar({
                            ...commonArgs,
                            keyRange: valueToUse.value.type.keyRange,
                            value: valueToUse.value.type.scalar,
                        }),
                    },
            type: type
                ? mapFromYamlScalar({
                      ...commonArgs,
                      ...type,
                  })
                : undefined,
        });
    }

    return { variables, errors };
}

function getItemsForSimpleOptionalVariableProps(allMapItems: ParsedMapItems) {
    const maybeDescriptionWithKeyRange =
        allMapItems.validScalars.withStringValue.find(
            ({ key }) => key == VariableProperty.Description,
        );

    const maybeDisabledWithKeyRange =
        allMapItems.validScalars.withBooleanValue.find(
            ({ key }) => key == VariableProperty.Disabled,
        );

    const maybeSecretWithKeyRange =
        allMapItems.validScalars.withBooleanValue.find(
            ({ key }) => key == VariableProperty.Secret,
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
              | Scalar<string>
              | {
                    data: { keyRange: Range; scalar: Scalar<string> };
                    type: { keyRange: Range; scalar: Scalar<VariableType> };
                };
      }
    | { errors: YamlParsingError[] }
    | undefined {
    const { map: variableDefinitionMap, fullDocumentRange } = commonParams;

    const matchingField = variableDefinitionMap.items.find(
        ({ key }) =>
            isScalar<string>(key) && key.value == VariableProperty.Value,
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
                          key: VariableProperty.Value,
                          expectedType: "Scalar",
                          valueRange: (getRangeForUnknownYamlItem(
                              matchingField.value,
                          ) ?? fullDocumentRange) as Range,
                      }),
                  };

        return "error" in maybeTypedValue
            ? { errors: [maybeTypedValue.error] }
            : {
                  keyRange: getRangeForItem(
                      matchingField.key as Scalar<string>,
                      commonParams,
                  ),
                  value: maybeTypedValue.item,
              };
    }

    const collectedErrors: YamlParsingError[] = [];

    const valueMapItem = matchingField.value;

    const { items: valueMapItems, errors: mapItemErrors } = getMapItems(
        valueMapItem,
        {
            scalars: {
                stringValues: [
                    VariableValueWithTypeProperty.Data,
                    VariableValueWithTypeProperty.Type,
                ],
            },
            sequenceValues: [],
        },
        commonParams,
    );
    collectedErrors.push(
        ...mapItemErrors
            .concat(
                getImplicitErrorsForAllInvalidMapItems(
                    valueMapItems,
                    commonParams,
                ),
            )
            .concat(
                valueMapItems.unknownKeys.map(({ key, keyRange }) =>
                    getErrorForUnknownKeyInMap({
                        ...commonParams,
                        unknownKey: key,
                        keyRange,
                    }),
                ),
            ),
    );

    let data: { keyRange: Range; scalar: Scalar<string> } | undefined =
        undefined;
    const maybeDataItem = valueMapItems.validScalars.withStringValue.find(
        ({ key }) => key == VariableValueWithTypeProperty.Data,
    );

    if (!maybeDataItem) {
        collectedErrors.push(
            getErrorForMissingKeyInMap({
                ...commonParams,
                missingKey: VariableValueWithTypeProperty.Data,
                map: valueMapItem,
            }),
        );
    } else {
        data = {
            keyRange: maybeDataItem.keyRange,
            scalar: maybeDataItem.value,
        };
    }

    const type = getItemVariableTypeScalarField(
        valueMapItems,
        commonParams,
        collectedErrors,
    );
    if (!type) {
        collectedErrors.push(
            getErrorForMissingKeyInMap({
                ...commonParams,
                missingKey: VariableValueWithTypeProperty.Type,
                map: valueMapItem,
            }),
        );
    }

    return collectedErrors.length > 0 || !data || !type
        ? { errors: collectedErrors }
        : {
              keyRange,
              value: {
                  data,
                  type: {
                      keyRange: type.keyRange,
                      scalar: type.value,
                  },
              },
          };
}

function getItemVariableTypeScalarField(
    allMapItems: ParsedMapItems,
    commonParams: CommonParsingArgs,
    errorsCollection: YamlParsingError[],
) {
    const maybeTypeWithKeyRange = allMapItems.validScalars.withStringValue.find(
        ({ key }) => key == VariableProperty.Type,
    );

    if (!maybeTypeWithKeyRange) {
        return undefined;
    }

    const maybeTypeToUse = getTypedVariableType(
        maybeTypeWithKeyRange.value,
        maybeTypeWithKeyRange.value,
        commonParams,
    );

    if ("error" in maybeTypeToUse) {
        errorsCollection.push(maybeTypeToUse.error);
        return undefined;
    }
    return {
        keyRange: maybeTypeWithKeyRange.keyRange,
        value: maybeTypeToUse.item,
    };
}

function getTypedVariableType(
    unTyped: Scalar<string>,
    valueScalar: Scalar<unknown>,
    commonArgs: CommonParsingArgs,
): { item: Scalar<VariableType> } | { error: YamlParsingError } {
    if (!(Object.values(VariableType) as string[]).includes(unTyped.value)) {
        return {
            error: {
                message: `Invalid type '${unTyped}'. Allowed types are ${JSON.stringify(Object.values(VariableType), null, 2)}`,
                range: getRangeForItem(valueScalar, commonArgs),
                code: YamlParsingErrorCode.Other,
            },
        };
    }

    return { item: unTyped as Scalar<VariableType> };
}
