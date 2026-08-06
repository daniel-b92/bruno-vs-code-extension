import {
    isMap,
    isScalar,
    isSeq,
    LineCounter,
    parseDocument,
    Scalar,
    YAMLMap,
    YAMLSeq,
} from "yaml";
import {
    ParsedEnvironmentVariable,
    Range,
    TextDocumentHelper,
    VariableType,
    YamlParsingError,
    YamlParsingSpecialErrorCode,
} from "../../..";
import {
    getBooleanValueByKeyFromMap,
    getStringValueByKeyFromMap,
} from "../../internal/yamlFormat/yamlMaps/getScalarValueByKeyFromMap";
import { mapErrors } from "../../internal/yamlFormat/util/mapErrors";
import { getTopLevelMapIfExists } from "../../internal/yamlFormat/yamlMaps/getTopLevelMapIfExists";
import { getYamlSequenceByKeyFromMap } from "../../internal/yamlFormat/yamlMaps/getYamlSequenceByKeyFromMap";
import { getYamlMapsFromSequence } from "../../internal/yamlFormat/yamlSequences/getYamlMapsFromSequence";
import { CommonParsingArgs } from "../../internal/yamlFormat/interfaces";
import { getYamlMapByKeyFromMap } from "../../internal/yamlFormat/yamlMaps/getYamlMapByKeyFromMap";
import { getRangeForError } from "../../internal/yamlFormat/util/getRangeForError";
import { getRangeForUnknownYamlItem } from "../../internal/yamlFormat/util/getRangeForUnknownYamlItem";
import { fromYamlRange } from "../../internal/yamlFormat/util/fromYamlRange";
import { getMapItems } from "../../internal/yamlFormat/yamlMaps/getMapItems";

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
          name?: string;
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

    collectedErrors.push(...mapItemErrors);

    const nameField = mapItems.validScalars.find(
        ({ key }) => key == EnvironmentKeyName.Name,
    )?.value;
    const variablesSequence = mapItems.validSequences.find(
        ({ key }) => key == EnvironmentKeyName.Name,
    )?.value;

    if (!variablesSequence) {
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
        name: "value" in nameField ? nameField.value : undefined,
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
    const { docHelper, fullDocumentRange } = commonArgs;

    for (const item of items) {
        const commonParams = { ...commonArgs, map: item, isTopLevelMap: false };

        const { description, disabled, secret } =
            getValuesForSimpleOptionalVariableProps(commonParams, errors);

        const maybeType = getStringValueByKeyFromMap({
            ...commonParams,
            key: VariableProperty.Type,
        });

        const untypedType = handleOptionalField(maybeType, errors);
        const maybeTypeToUse =
            untypedType === undefined
                ? undefined
                : getTypedVariableType(untypedType, item, {
                      docHelper,
                      fullDocumentRange,
                  });
        let typeToUse: VariableType | undefined = undefined;
        if (maybeTypeToUse && "error" in maybeTypeToUse) {
            errors.push(maybeTypeToUse.error);
        } else {
            typeToUse = maybeTypeToUse?.type;
        }
        const maybeValue = getValueFromMapItemVariable(commonParams);
        let valueToUse:
            | string
            | {
                  type: VariableType;
                  data: string;
              }
            | undefined = undefined;
        if (
            maybeValue &&
            typeof maybeValue == "object" &&
            "errors" in maybeValue
        ) {
            errors.push(...maybeValue.errors);
        } else {
            valueToUse = maybeValue;
        }

        const maybeName = getStringValueByKeyFromMap({
            ...commonParams,
            key: VariableProperty.Name,
        });
        if ("error" in maybeName) {
            // The 'name' field is the only one that always has to be present.
            errors.push(maybeName.error);
            continue;
        }

        variables.push({
            name: maybeName.value,
            description,
            disabled,
            secret,
            value: valueToUse,
            type: typeToUse,
        });
    }

    return { variables, errors };
}

function getValuesForSimpleOptionalVariableProps(
    commonParams: CommonParsingArgs & {
        map: YAMLMap<unknown, unknown>;
        isTopLevelMap: boolean;
    },
    errorsCollection: YamlParsingError[],
) {
    const maybeDescription = getStringValueByKeyFromMap({
        ...commonParams,
        key: VariableProperty.Description,
    });
    const description = handleOptionalField(maybeDescription, errorsCollection);

    const maybeDisabled = getBooleanValueByKeyFromMap({
        ...commonParams,
        key: VariableProperty.Disabled,
    });
    // If not defined, the default is enabled for a field.
    const disabled =
        handleOptionalField(maybeDisabled, errorsCollection) ?? false;

    const maybeSecret = getBooleanValueByKeyFromMap({
        ...commonParams,
        key: VariableProperty.Secret,
    });
    // If not defined, a field is treated as non-secret by default.
    const secret = handleOptionalField(maybeSecret, errorsCollection) ?? false;

    return { description, disabled, secret };
}

function getValueFromMapItemVariable(commonParams: {
    map: YAMLMap<unknown, unknown>;
    isTopLevelMap: boolean;
    docHelper: TextDocumentHelper;
    fullDocumentRange: Range;
}):
    | string
    | { type: VariableType; data: string }
    | { errors: YamlParsingError[] }
    | undefined {
    const { map: variableDefinitionMap } = commonParams;
    const hasKey = variableDefinitionMap.has(VariableProperty.Value);

    if (!hasKey) {
        // Field is optional. Is not necessarily an error, if it's missing.
        return undefined;
    }

    const actualField = variableDefinitionMap.get(VariableProperty.Value);
    if (!isMap(actualField)) {
        const maybeStringValue = getStringValueByKeyFromMap({
            ...commonParams,
            key: VariableProperty.Value,
        });
        return "error" in maybeStringValue
            ? { errors: [maybeStringValue.error] }
            : maybeStringValue.value;
    }

    const collectedErrors: YamlParsingError[] = [];

    const maybeChildMap = getYamlMapByKeyFromMap({
        ...commonParams,
        key: VariableProperty.Value,
    });

    if ("error" in maybeChildMap) {
        // Error is blocking, since no further parsing of map items can occur here.
        return { errors: [maybeChildMap.error] };
    }
    const valueMapItem = maybeChildMap.map;

    const maybeData = getStringValueByKeyFromMap({
        ...commonParams,
        map: maybeChildMap.map,
        key: VariableValueWithTypeProperty.Data,
    });
    if ("error" in maybeData) {
        collectedErrors.push(maybeData.error);
    }

    const parsedType = getStringValueByKeyFromMap({
        ...commonParams,
        map: valueMapItem,
        key: VariableValueWithTypeProperty.Type,
    });
    if ("error" in parsedType) {
        // Error is blocking for further handling of the 'type' field.
        return { errors: collectedErrors.concat(parsedType.error) };
    }

    const maybeTypeToUse = getTypedVariableType(
        parsedType.value,
        valueMapItem,
        commonParams,
    );
    if ("error" in maybeTypeToUse) {
        return { errors: collectedErrors.concat(maybeTypeToUse.error) };
    }

    return "error" in maybeData
        ? { errors: collectedErrors }
        : { data: maybeData.value, type: maybeTypeToUse.type };
}

function handleOptionalField<T>(
    maybeValue:
        | {
              value: T;
          }
        | {
              error: YamlParsingError;
          },
    errorsCollection: YamlParsingError[],
): T | undefined {
    if ("value" in maybeValue) {
        return maybeValue.value;
    }

    if (
        maybeValue.error.code !== YamlParsingSpecialErrorCode.FieldDoesNotExist
    ) {
        errorsCollection.push(maybeValue.error);
        return undefined;
    }
    return undefined;
}

function getTypedVariableType(
    unTyped: string,
    variableItem: YAMLMap<unknown, unknown>,
    commonArgs: CommonParsingArgs,
): { type: VariableType } | { error: YamlParsingError } {
    if (!(Object.values(VariableType) as string[]).includes(unTyped)) {
        return {
            error: {
                message: `Invalid type '${unTyped}'. Allowed types are ${JSON.stringify(Object.values(VariableType), null, 2)}`,
                range: getRangeForError(variableItem, commonArgs),
            },
        };
    }

    return { type: unTyped as VariableType };
}
