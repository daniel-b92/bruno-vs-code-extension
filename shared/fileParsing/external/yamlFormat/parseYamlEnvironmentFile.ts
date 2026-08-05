import { LineCounter, parseDocument, YAMLMap } from "yaml";
import { Range, TextDocumentHelper, YamlParsingError } from "../../..";
import {
    getScalarFieldBooleanValueFromMap,
    getScalarFieldStringValueFromMap,
} from "../../internal/yamlFormat/yamlMaps/getScalarFieldValueFromMap";
import { mapErrors } from "../../internal/yamlFormat/util/mapErrors";
import { getTopLevelMapIfExists } from "../../internal/yamlFormat/yamlMaps/getTopLevelMapIfExists";
import { getYamlSequenceByKeyFromMap } from "../../internal/yamlFormat/yamlMaps/getYamlSequenceByKeyFromMap";
import { getYamlMapsFromSequence } from "../../internal/yamlFormat/yamlSequences/getYamlMapsFromSequence";
import { CommonParsingArgs } from "../../internal/yamlFormat/interfaces";
import { fromYamlRange } from "../../internal/yamlFormat/util/fromYamlRange";

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

// enum VariableValueProperty {
//     Type = "type",
//     Data = "data",
// }

enum VariableType {
    Number = "number",
    Boolean = "boolean",
    Object = "object",
}

interface Variable {
    name: string;
    value?: string | { type: VariableType; data: string };
    description?: string;
    type?: VariableType;
    secret: boolean;
    disabled: boolean;
}

export function parseYamlEnvironmentFile(docHelper: TextDocumentHelper) {
    const document = parseDocument(docHelper.getText(), {
        lineCounter: new LineCounter(),
    });
    const fullDocumentRange = docHelper.getTextRange();
    const commonArgs = { docHelper, fullDocumentRange };

    if (document.errors.length > 0) {
        console.log("Got technical parsing errors.");
        return mapErrors(document.errors, fullDocumentRange);
    }

    const maybeTopLevelMap = getTopLevelMapIfExists({
        ...commonArgs,
        node: document.contents,
    });
    if ("error" in maybeTopLevelMap) {
        console.log("Got errors for top level map typeguard.");
        return maybeTopLevelMap.error;
    }
    const { map: topLevelMap } = maybeTopLevelMap;

    const maybeNameField = getScalarFieldStringValueFromMap({
        ...commonArgs,
        map: topLevelMap,
        key: EnvironmentKeyName.Name,
        isTopLevelMap: true,
    });
    const maybeVariablesSequence = getYamlSequenceByKeyFromMap({
        ...commonArgs,
        map: topLevelMap,
        key: EnvironmentKeyName.Variables,
        isTopLevelMap: true,
    });

    if ("error" in maybeNameField || "error" in maybeVariablesSequence) {
        const nameFieldError =
            "error" in maybeNameField ? maybeNameField.error : undefined;
        const variablesSeqError =
            "error" in maybeVariablesSequence
                ? maybeVariablesSequence.error
                : undefined;
        return [nameFieldError, variablesSeqError].filter(
            (v) => v != undefined,
        );
    }

    const { items: variableItems, errors } = getYamlMapsFromSequence({
        ...commonArgs,
        sequence: maybeVariablesSequence.sequence,
    });

    const { variables, errors: additionalErrors } = getVariablesFromMapItems(
        variableItems,
        commonArgs,
    );

    return {
        name: maybeNameField.value,
        variables,
        errors: errors.concat(additionalErrors),
    };
}

function getVariablesFromMapItems(
    items: YAMLMap<unknown, unknown>[],
    commonArgs: CommonParsingArgs,
): { variables: Variable[]; errors: YamlParsingError[] } {
    const variables: Variable[] = [];
    const errors: YamlParsingError[] = [];
    const { docHelper, fullDocumentRange } = commonArgs;

    for (const item of items) {
        const commonParams = { ...commonArgs, map: item, isTopLevelMap: false };
        const maybeName = getScalarFieldStringValueFromMap({
            ...commonParams,
            key: VariableProperty.Name,
        });
        // The name field is the only one that always has to be present.
        if ("error" in maybeName) {
            errors.push(maybeName.error);
            continue;
        }

        const maybeDescription = getScalarFieldStringValueFromMap({
            ...commonParams,
            key: VariableProperty.Description,
        });
        const maybeDisabled = getScalarFieldBooleanValueFromMap({
            ...commonParams,
            key: VariableProperty.Disabled,
        });
        const maybeSecret = getScalarFieldBooleanValueFromMap({
            ...commonParams,
            key: VariableProperty.Secret,
        });
        const maybeType = getScalarFieldStringValueFromMap({
            ...commonParams,
            key: VariableProperty.Type,
        });

        const description = handleOptionalField(maybeDescription, errors);
        const parsedType = handleOptionalField(maybeType, errors);
        let typeToUse: VariableType | undefined = undefined;
        if (
            parsedType &&
            !(Object.values(VariableType) as string[]).includes(parsedType)
        ) {
            errors.push({
                message: `Invalid type '${parsedType}'. Allowed types are ${JSON.stringify(Object.values(VariableType), null, 2)}`,
                range:
                    (item.range
                        ? fromYamlRange(item.range, docHelper)
                        : fullDocumentRange) ?? fullDocumentRange,
            });
        } else if (parsedType) {
            typeToUse = parsedType as VariableType;
        }

        // If not defined, the default is enabled for a field.
        const disabled = handleOptionalField(maybeDisabled, errors) ?? false;
        // If not defined, a field is treated as non-secret by default.
        const secret = handleOptionalField(maybeSecret, errors) ?? false;

        variables.push({
            name: maybeName.value,
            description,
            disabled,
            secret,
            value: getValueFromMapItemVariable(commonParams),
            type: typeToUse,
        });
    }

    return { variables, errors };
}

function getValueFromMapItemVariable(commonParams: {
    map: YAMLMap<unknown, unknown>;
    isTopLevelMap: boolean;
    docHelper: TextDocumentHelper;
    fullDocumentRange: Range;
}) {
    const maybeStringValue = getScalarFieldStringValueFromMap({
        ...commonParams,
        key: VariableProperty.Value,
    });

    if ("value" in maybeStringValue) {
        return maybeStringValue.value;
    }

    if (!maybeStringValue.fieldExists) {
        return undefined;
    }

    // ToDo: Also handle case where value is again a Yaml map, with a certain type.
    return undefined;
}

function handleOptionalField<T>(
    maybeValue:
        | {
              value: T;
          }
        | {
              fieldExists: boolean;
              error: YamlParsingError;
          },
    errorsCollection: YamlParsingError[],
): T | undefined {
    if ("value" in maybeValue) {
        return maybeValue.value;
    }

    if (maybeValue.fieldExists) {
        errorsCollection.push(maybeValue.error);
        return undefined;
    }
    return undefined;
}
