import { YAMLSeq } from "yaml";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedRequestVariable,
} from "../interfaces";
import { YamlParsingError } from "../../../..";
import { getYamlMapsFromSequence } from "../yamlSequences/getYamlMapsFromSequence";
import {
    ValidatedMapItems,
    getValidatedMapItems,
} from "../yamlMaps/getValidatedMapItems";
import { getValueFieldFromVariable } from "./getValueFieldFromVariable";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import { RequestVariableProperty } from "../../../external/yamlFormat/constants/sharedConstants";
import { getRangeForItem } from "../util/getRangeForItem";

export function parseVariablesFromYamlSequence(
    variablesSequence: YAMLSeq,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<{
    enabled: ParsedRequestVariable[];
    disabled: ParsedRequestVariable[];
}> {
    const enabledVariables: ParsedRequestVariable[] = [];
    const disabledVariables: ParsedRequestVariable[] = [];
    const errors: YamlParsingError[] = [];

    const { items: variableMaps, errors: sequenceParsingErrors } =
        getYamlMapsFromSequence({
            ...commonArgs,
            sequence: variablesSequence,
        });
    errors.push(...sequenceParsingErrors);

    const keysForStringScalars = [
        RequestVariableProperty.Description,
        RequestVariableProperty.Name,
    ];
    const keysForBooleanScalars = [RequestVariableProperty.Disabled];

    for (const currentMap of variableMaps) {
        const { getString, getBoolean, missingProperties } =
            getValidatedMapItems(
                currentMap,
                {
                    scalars: {
                        stringValues: keysForStringScalars,
                        booleanValues: keysForBooleanScalars,
                    },
                    mandatoryKeys: [RequestVariableProperty.Name],
                    // The value gets parsed separately, because it can be either a scalar or a map.
                    additionalAllowedKeys: [RequestVariableProperty.Value],
                },
                commonArgs,
                errors,
            );
        const { description, disabled } =
            getItemsForSimpleOptionalVariableProps({
                getString,
                getBoolean,
            });

        const { result: maybeValue, errors: valueErrors } =
            getValueFieldFromVariable(currentMap, commonArgs);
        errors.push(...valueErrors);

        const name = getString(RequestVariableProperty.Name);

        const variable: ParsedRequestVariable = {
            valueRange: getRangeForItem(currentMap, commonArgs),
            missingProperties,
            properties: {
                name: stripKeyFromResult(name),
                description,
                disabled,
                value: maybeValue,
            },
        };

        if (variable.properties.disabled.effectiveValue) {
            disabledVariables.push(variable);
        } else {
            enabledVariables.push(variable);
        }
    }

    return {
        result: {
            enabled: enabledVariables,
            disabled: disabledVariables,
        },
        errors,
    };
}

function getItemsForSimpleOptionalVariableProps({
    getString,
    getBoolean,
}: Pick<ValidatedMapItems, "getString" | "getBoolean">) {
    const maybeDescriptionWithKeyRange = getString(
        RequestVariableProperty.Description,
    );
    const maybeDisabledWithKeyRange = getBoolean(
        RequestVariableProperty.Disabled,
    );
    // The default value for 'disabled' is false, when not defined.
    const disabledEffectiveValue =
        maybeDisabledWithKeyRange !== undefined
            ? maybeDisabledWithKeyRange.value
            : false;

    return {
        description: stripKeyFromResult(maybeDescriptionWithKeyRange),
        disabled: {
            effectiveValue: disabledEffectiveValue,
            field: stripKeyFromResult(maybeDisabledWithKeyRange),
        },
    };
}
