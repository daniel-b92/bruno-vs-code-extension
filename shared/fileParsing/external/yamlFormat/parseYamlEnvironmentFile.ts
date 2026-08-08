import {
    isMap,
    isScalar,
    LineCounter,
    parseDocument,
    Scalar,
    YAMLMap,
} from "yaml";
import {
    EnvironmentVariableProperty,
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
            missingProperties:
                allMapItems.missingKeys as EnvironmentVariableProperty[],
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
                  keyRange: getRangeForItem(
                      matchingField.key as Scalar<string>,
                      commonParams,
                  ),
                  value: maybeTypedValue.item,
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
    const data: { keyRange: Range; scalar: Scalar<string> } | undefined =
        maybeDataItem
            ? {
                  keyRange: maybeDataItem.keyRange,
                  scalar: maybeDataItem.value,
              }
            : undefined;

    const type = getItemVariableTypeScalarField(
        valueMapItems,
        commonParams,
        collectedErrors,
    );

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
        ({ key }) => key == EnvironmentVariableProperty.Type,
    );

    if (!maybeTypeWithKeyRange) {
        return undefined;
    }

    const maybeTypeToUse = getTypedVariableType(
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
    commonArgs: CommonParsingArgs,
): { item: Scalar<VariableType> } | { error: YamlParsingError } {
    if (!(Object.values(VariableType) as string[]).includes(unTyped.value)) {
        return {
            error: {
                message: `Invalid type '${unTyped}'. Allowed types are ${JSON.stringify(Object.values(VariableType), null, 2)}`,
                range: getRangeForItem(unTyped, commonArgs),
                code: YamlParsingErrorCode.Other,
            },
        };
    }

    return { item: unTyped as Scalar<VariableType> };
}
