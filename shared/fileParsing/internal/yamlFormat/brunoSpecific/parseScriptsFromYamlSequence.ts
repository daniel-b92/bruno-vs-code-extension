import { YAMLSeq } from "yaml";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedScript,
} from "../interfaces";
import { WithKeyAndValueRange, YamlParsingError } from "../../../..";
import { getYamlMapsFromSequence } from "../yamlSequences/getYamlMapsFromSequence";
import {
    ValidatedMapItems,
    getValidatedMapItems,
} from "../yamlMaps/getValidatedMapItems";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import { getTypedValueFromList } from "../scalars/getTypedValueFromList";
import {
    ScriptMapProperty,
    ScriptType,
} from "../../../external/yamlFormat/constants/sharedConstants";
import { getRangeForItem } from "../util/getRangeForItem";

export function parseScriptsFromYamlSequence(
    scriptsSequence: YAMLSeq,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedScript[]> {
    const scripts: ParsedScript[] = [];
    const errors: YamlParsingError[] = [];

    const { items: scriptMaps, errors: sequenceParsingErrors } =
        getYamlMapsFromSequence({
            ...commonArgs,
            sequence: scriptsSequence,
        });
    errors.push(...sequenceParsingErrors);

    const keysForStringScalars = Object.values(ScriptMapProperty);

    for (const currentMap of scriptMaps) {
        const { getString, missingProperties } = getValidatedMapItems(
            currentMap,
            {
                scalars: { stringValues: keysForStringScalars },
                // All properties are mandatory for scripts.
                mandatoryKeys: keysForStringScalars,
            },
            commonArgs,
            errors,
        );
        const { errors: parsingErrors, result: parsedScript } =
            parseScript(getString);
        errors.push(...parsingErrors);

        if (!parsedScript) {
            continue;
        }

        const { code, type } = parsedScript;
        scripts.push({
            missingProperties,
            properties: { code, type },
            valueRange: getRangeForItem(currentMap, commonArgs),
        });
    }

    return {
        result: scripts,
        errors,
    };
}

function parseScript(
    getString: ValidatedMapItems["getString"],
): MaybeResultWithErrors<{
    type?: WithKeyAndValueRange<ScriptType>;
    code?: WithKeyAndValueRange<string>;
}> {
    const collectedErrors: YamlParsingError[] = [];
    const maybeUntypedTypeWithKeyRange = getString(ScriptMapProperty.Type);
    const maybeCodeWithKeyRange = getString(ScriptMapProperty.Code);

    const maybeTypedType = !maybeUntypedTypeWithKeyRange
        ? undefined
        : getTypedValueFromList(
              {
                  allowedValues: Object.values(ScriptType),
                  allStringValues: [maybeUntypedTypeWithKeyRange],
                  keyName: ScriptMapProperty.Type,
              },
              collectedErrors,
          );

    return {
        errors: collectedErrors,
        result: {
            code: stripKeyFromResult(maybeCodeWithKeyRange),
            type: maybeTypedType?.value,
        },
    };
}
