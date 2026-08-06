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
    YamlParsingSpecialErrorCode,
} from "../../..";
import { mapErrors } from "../../internal/yamlFormat/util/mapErrors";
import { getTopLevelMapIfExists } from "../../internal/yamlFormat/yamlMaps/getTopLevelMapIfExists";
import { getYamlMapsFromSequence } from "../../internal/yamlFormat/yamlSequences/getYamlMapsFromSequence";
import {
    CommonParsingArgs,
    ParsedMapItems,
} from "../../internal/yamlFormat/interfaces";
import { getRangeForError } from "../../internal/yamlFormat/util/getRangeForError";
import { getMapItems } from "../../internal/yamlFormat/yamlMaps/getMapItems";
import { getErrorForUnknownKeyInMap } from "../../internal/yamlFormat/yamlMaps/getErrorForUnknownKeyInMap";
import { getErrorForValueWithUnexpectedType } from "../../internal/yamlFormat/util/getErrorForItemWithUnexpectedTypeInMap";
import {
    getBooleanYamlScalar,
    getStringYamlScalar,
} from "../../internal/yamlFormat/yamlScalars/getTypedYamlScalar";
import { getRangeForUnknownYamlItem } from "../../internal/yamlFormat/util/getRangeForUnknownYamlItem";
import { getErrorForMissingKeyInMap } from "../../internal/yamlFormat/yamlMaps/getErrorForMissingKeyInMap";

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
            scalarValues: [EnvironmentKeyName.Name],
            sequenceValues: [EnvironmentKeyName.Variables],
        },
        commonArgs,
    );

    collectedErrors.push(
        ...mapItemErrors.concat(
            getImplicitErrorsForAllInvalidMapItems(mapItems, commonArgs),
        ),
    );

    const nameField = mapItems.validScalars.find(
        ({ key }) => key == EnvironmentKeyName.Name,
    )?.item;
    const variablesSequence = mapItems.validSequences.find(
        ({ key }) => key == EnvironmentKeyName.Variables,
    )?.item;

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
        name:
            nameField && typeof nameField.value == "string"
                ? nameField.value
                : undefined,
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
                scalarValues: [
                    VariableProperty.Description,
                    VariableProperty.Disabled,
                    VariableProperty.Name,
                    VariableProperty.Secret,
                    VariableProperty.Type,
                ],
                sequenceValues: [],
            },
            commonArgs,
        );

        errors.push(
            ...mapItemErrors.concat(
                getImplicitErrorsForAllInvalidMapItems(allMapItems, commonArgs),
            ),
        );
        const { description, disabled, secret } =
            getItemsForSimpleOptionalVariableProps(
                allMapItems,
                commonArgs,
                errors,
            );

        const type = getItemVariableTypeScalarField(
            allMapItems,
            currentMap,
            commonArgs,
            errors,
        );
        const maybeValue = getValueFromMapItemVariable(commonParams);
        if (maybeValue && "errors" in maybeValue) {
            errors.push(...maybeValue.errors);
        }

        const valueToUse =
            maybeValue && !("errors" in maybeValue) ? maybeValue : undefined;

        const maybeName = allMapItems.validScalars.find(
            ({ key }) => key == VariableProperty.Name,
        )?.item;

        if (!maybeName) {
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
        const maybeTypedName = getStringYamlScalar(
            maybeName,
            VariableProperty.Name,
            commonParams,
        );
        if ("error" in maybeTypedName) {
            // The 'name' field is the only one that always has to be present.
            errors.push(maybeTypedName.error);
            continue;
        }

        const name = maybeTypedName.item;

        variables.push({
            name: maybeName.value,
            description: maybeDescription,
            disabled,
            secret,
            value: valueToUse,
            type: typeToUse,
        });
    }

    return { variables, errors };
}

function getItemsForSimpleOptionalVariableProps(
    allMapItems: ParsedMapItems,
    commonParams: CommonParsingArgs,
    errorsCollection: YamlParsingError[],
) {
    const maybeDescription = allMapItems.validScalars.find(
        ({ key }) => key == VariableProperty.Description,
    )?.item;

    const maybeTypedDescription = maybeDescription
        ? getStringYamlScalar(
              maybeDescription,
              VariableProperty.Description,
              commonParams,
          )
        : undefined;

    const description = maybeTypedDescription
        ? handleOptionalField(maybeTypedDescription, errorsCollection)
        : undefined;

    const maybeDisabled = allMapItems.validScalars.find(
        ({ key }) => key == VariableProperty.Disabled,
    )?.item;

    const maybeTypedDisabled = maybeDisabled
        ? getBooleanYamlScalar(
              maybeDisabled,
              VariableProperty.Disabled,
              commonParams,
          )
        : undefined;

    const disabled = maybeTypedDisabled
        ? handleOptionalField(maybeTypedDisabled, errorsCollection)
        : undefined;

    const maybeSecret = allMapItems.validScalars.find(
        ({ key }) => key == VariableProperty.Secret,
    )?.item;

    const maybeTypedSecret = maybeSecret
        ? getBooleanYamlScalar(
              maybeSecret,
              VariableProperty.Secret,
              commonParams,
          )
        : undefined;

    const secret = maybeTypedSecret
        ? handleOptionalField(maybeTypedSecret, errorsCollection)
        : undefined;

    return { description, disabled, secret };
}

function getValueFromMapItemVariable(commonParams: {
    map: YAMLMap<unknown, unknown>;
    isTopLevelMap: boolean;
    docHelper: TextDocumentHelper;
    fullDocumentRange: Range;
}):
    | Scalar<string>
    | { data: Scalar<string>; type: Scalar<VariableType> }
    | { errors: YamlParsingError[] }
    | undefined {
    const { map: variableDefinitionMap, fullDocumentRange } = commonParams;

    const matchingField = variableDefinitionMap.items.find(
        (item) =>
            typeof item.key == "string" && item.key == VariableProperty.Value,
    );

    if (!matchingField) {
        // Field is optional. Is not necessarily an error, if it's missing.
        return undefined;
    }

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
            : maybeTypedValue.item;
    }

    const collectedErrors: YamlParsingError[] = [];

    const valueMapItem = matchingField.value;

    const { items: valueMapItems, errors: mapItemErrors } = getMapItems(
        valueMapItem,
        {
            scalarValues: [
                VariableValueWithTypeProperty.Data,
                VariableValueWithTypeProperty.Type,
            ],
            sequenceValues: [],
        },
        commonParams,
    );
    collectedErrors.push(
        ...mapItemErrors.concat(
            getImplicitErrorsForAllInvalidMapItems(valueMapItems, commonParams),
        ),
    );

    let data: Scalar<string> | undefined = undefined;
    const maybeData = valueMapItems.validScalars.find(
        ({ key }) => key == VariableValueWithTypeProperty.Data,
    )?.item;

    if (!maybeData) {
        collectedErrors.push(
            getErrorForMissingKeyInMap({
                ...commonParams,
                missingKey: VariableValueWithTypeProperty.Data,
                map: valueMapItem,
            }),
        );
    } else {
        const maybeTypedData = getStringYamlScalar(
            maybeData,
            VariableValueWithTypeProperty.Data,
            commonParams,
        );
        if ("error" in maybeTypedData) {
            collectedErrors.push(maybeTypedData.error);
        } else {
            data = maybeTypedData.item;
        }
    }

    const type = getItemVariableTypeScalarField(
        valueMapItems,
        valueMapItem,
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
        : { data, type };
}

function getItemVariableTypeScalarField(
    allMapItems: ParsedMapItems,
    correspondingMap: YAMLMap<unknown, unknown>,
    commonParams: CommonParsingArgs,
    errorsCollection: YamlParsingError[],
) {
    const maybeType = allMapItems.validScalars.find(
        ({ key }) => key == VariableProperty.Type,
    )?.item;

    if (!maybeType) {
        return undefined;
    }
    const maybeTypeAsString = getStringYamlScalar(
        maybeType,
        VariableProperty.Type,
        commonParams,
    );

    if ("error" in maybeTypeAsString) {
        errorsCollection.push(maybeTypeAsString.error);
        return undefined;
    }

    const maybeTypeToUse = getTypedVariableType(
        maybeTypeAsString.item,
        correspondingMap,
        commonParams,
    );

    if ("error" in maybeTypeToUse) {
        errorsCollection.push(maybeTypeToUse.error);
        return undefined;
    }
    return maybeTypeToUse.item;
}

function handleOptionalField<T>(
    maybeItem:
        | {
              item: T;
          }
        | {
              error: YamlParsingError;
          },
    errorsCollection: YamlParsingError[],
): T | undefined {
    if ("item" in maybeItem) {
        return maybeItem.item;
    }

    if (
        maybeItem.error.code !== YamlParsingSpecialErrorCode.FieldDoesNotExist
    ) {
        errorsCollection.push(maybeItem.error);
        return undefined;
    }
    return undefined;
}

function getTypedVariableType(
    unTyped: Scalar<string>,
    variableItem: YAMLMap<unknown, unknown>,
    commonArgs: CommonParsingArgs,
): { item: Scalar<VariableType> } | { error: YamlParsingError } {
    if (!(Object.values(VariableType) as string[]).includes(unTyped.value)) {
        return {
            error: {
                message: `Invalid type '${unTyped}'. Allowed types are ${JSON.stringify(Object.values(VariableType), null, 2)}`,
                range: getRangeForError(variableItem, commonArgs),
            },
        };
    }

    return { item: unTyped as Scalar<VariableType> };
}

function getImplicitErrorsForAllInvalidMapItems(
    mapItems: ParsedMapItems,
    commonArgs: CommonParsingArgs,
) {
    return mapItems.unknownKeys
        .map(({ key, keyRange }) =>
            getErrorForUnknownKeyInMap({
                ...commonArgs,
                unknownKey: key,
                keyRange,
            }),
        )
        .concat(
            mapItems.invalidScalars.map(({ key, valueRange }) =>
                getErrorForValueWithUnexpectedType({
                    ...commonArgs,
                    key,
                    valueRange,
                    expectedType: "Scalar",
                }),
            ),
        )
        .concat(
            mapItems.invalidSequences.map(({ key, valueRange }) =>
                getErrorForValueWithUnexpectedType({
                    ...commonArgs,
                    key,
                    valueRange,
                    expectedType: "Sequence",
                }),
            ),
        );
}
