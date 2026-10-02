import { YAMLMap, YAMLSeq } from "yaml";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedAction,
    ParsedYamlMapWithKeyAndValueRange,
    WithKeyAndKeyRange,
} from "../interfaces";
import { Range, WithKeyAndValueRange, YamlParsingError } from "../../../..";
import { getYamlMapsFromSequence } from "../yamlSequences/getYamlMapsFromSequence";
import {
    ValidatedMapItems,
    getValidatedMapItems,
} from "../yamlMaps/getValidatedMapItems";
import { parseIfPresent } from "../util/parseIfPresent";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import {
    ActionPhase,
    ActionProperty,
    ActionSelectorMethod,
    ActionSelectorProperty,
    ActionType,
    ActionVariableProperty,
    ActionVariableScope,
} from "../../../external/yamlFormat/constants/actionConstants";
import { getTypedValueFromList } from "../scalars/getTypedValueFromList";
import { getRangeForItem } from "../util/getRangeForItem";

export function parseActionsFromYamlSequence(
    actionsSequence: YAMLSeq,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<{
    enabled: ParsedAction[];
    disabled: ParsedAction[];
}> {
    const enabledActions: ParsedAction[] = [];
    const disabledActions: ParsedAction[] = [];
    const errors: YamlParsingError[] = [];

    const { items: actionsMaps, errors: sequenceParsingErrors } =
        getYamlMapsFromSequence({
            ...commonArgs,
            sequence: actionsSequence,
        });
    errors.push(...sequenceParsingErrors);

    const keysForStringScalars = [
        ActionProperty.Description,
        ActionProperty.Phase,
        ActionProperty.Type,
    ];
    const keysForBooleanScalars = [ActionProperty.Disabled];
    const keysForMaps = [ActionProperty.Selector, ActionProperty.Variable];
    const optionalKeys: string[] = [
        ActionProperty.Description,
        ActionProperty.Disabled,
    ];

    for (const currentMap of actionsMaps) {
        const mapItems = getValidatedMapItems(
            currentMap,
            {
                scalars: {
                    stringValues: keysForStringScalars,
                    booleanValues: keysForBooleanScalars,
                },
                mapValues: keysForMaps,
                mandatoryKeys: Object.values(ActionProperty).filter(
                    (key) => !optionalKeys.includes(key),
                ),
            },
            commonArgs,
            errors,
        );
        const maybeAction = parseAction(
            getRangeForItem(currentMap, commonArgs),
            mapItems,
            commonArgs,
        );
        const { errors: actionErrors, result: action } = maybeAction;
        errors.push(...actionErrors);

        if (action?.properties.disabled?.effectiveValue) {
            disabledActions.push(action);
        } else if (action) {
            enabledActions.push(action);
        }
    }

    return {
        errors,
        result: { enabled: enabledActions, disabled: disabledActions },
    };
}

function parseAction(
    mapRange: Range,
    { getString, getBoolean, getMap, missingProperties }: ValidatedMapItems,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedAction> {
    const errors: YamlParsingError[] = [];

    const maybeUntypedTypeWithKeyRange = getString(ActionProperty.Type);
    const maybeType = maybeUntypedTypeWithKeyRange
        ? getTypedValueFromList(
              {
                  allowedValues: Object.values(ActionType),
                  allStringValues: [maybeUntypedTypeWithKeyRange],
                  keyName: ActionProperty.Type,
              },
              errors,
          )
        : undefined;

    const maybeUntypedPhaseWithKeyRange = getString(ActionProperty.Phase);
    const maybePhase = maybeUntypedPhaseWithKeyRange
        ? getTypedValueFromList(
              {
                  allowedValues: Object.values(ActionPhase),
                  allStringValues: [maybeUntypedPhaseWithKeyRange],
                  keyName: ActionProperty.Phase,
              },
              errors,
          )
        : undefined;

    const maybeDescriptionWithKeyRange = getString(ActionProperty.Description);
    const maybeDisabledWithKeyRange = getBoolean(ActionProperty.Disabled);
    // The default value for 'disabled' is false, when not defined.
    const disabledEffectiveValue =
        maybeDisabledWithKeyRange !== undefined
            ? maybeDisabledWithKeyRange.value
            : false;

    const selector = parseIfPresent(
        getMap(ActionProperty.Selector),
        (selectorMap) => parseSelector(selectorMap, commonArgs),
        errors,
    );
    const variable = parseIfPresent(
        getMap(ActionProperty.Variable),
        (variableMap) => parseVariable(variableMap, commonArgs),
        errors,
    );

    return {
        errors,
        result: {
            valueRange: mapRange,
            properties: {
                phase: maybePhase?.value,
                type: maybeType?.value,
                description: stripKeyFromResult(maybeDescriptionWithKeyRange),
                disabled: {
                    effectiveValue: disabledEffectiveValue,
                    field: stripKeyFromResult(maybeDisabledWithKeyRange),
                },
                selector,
                variable,
            },
            missingProperties,
        },
    };
}

function parseSelector(
    { keyRange, value: selectorMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<
    ParsedYamlMapWithKeyAndValueRange<{
        expression?: WithKeyAndValueRange<string>;
        method?: WithKeyAndValueRange<ActionSelectorMethod>;
    }>
> {
    const errors: YamlParsingError[] = [];
    const expectedStringScalars = Object.values(ActionSelectorProperty);

    const { getString, missingProperties } = getValidatedMapItems(
        selectorMap,
        {
            scalars: { stringValues: expectedStringScalars },
            // All properties are mandatory.
            mandatoryKeys: expectedStringScalars,
        },
        commonArgs,
        errors,
    );

    const maybeExpressionWithKeyRange = getString(
        ActionSelectorProperty.Expression,
    );
    const maybeUntypedMethod = getString(ActionSelectorProperty.Method);
    const maybeTypedMethod = !maybeUntypedMethod
        ? undefined
        : getTypedValueFromList(
              {
                  allowedValues: Object.values(ActionSelectorMethod),
                  allStringValues: [maybeUntypedMethod],
                  keyName: ActionSelectorProperty.Method,
              },
              errors,
          );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(selectorMap, commonArgs),
            properties: {
                expression: stripKeyFromResult(maybeExpressionWithKeyRange),
                method: maybeTypedMethod?.value,
            },
            missingProperties,
        },
    };
}
function parseVariable(
    { keyRange, value: variableMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<
    ParsedYamlMapWithKeyAndValueRange<{
        name?: WithKeyAndValueRange<string>;
        scope?: WithKeyAndValueRange<ActionVariableScope>;
    }>
> {
    const errors: YamlParsingError[] = [];
    const expectedStringScalars = Object.values(ActionVariableProperty);

    const { getString, missingProperties } = getValidatedMapItems(
        variableMap,
        {
            scalars: { stringValues: expectedStringScalars },
            // All properties are mandatory.
            mandatoryKeys: expectedStringScalars,
        },
        commonArgs,
        errors,
    );

    const maybeNameWithKeyRange = getString(ActionVariableProperty.Name);
    const maybeUntypedScope = getString(ActionVariableProperty.Scope);
    const maybeTypedScope = !maybeUntypedScope
        ? undefined
        : getTypedValueFromList(
              {
                  allowedValues: Object.values(ActionVariableScope),
                  allStringValues: [maybeUntypedScope],
                  keyName: ActionVariableProperty.Scope,
              },
              errors,
          );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(variableMap, commonArgs),
            properties: {
                name: stripKeyFromResult(maybeNameWithKeyRange),
                scope: maybeTypedScope?.value,
            },
            missingProperties,
        },
    };
}
