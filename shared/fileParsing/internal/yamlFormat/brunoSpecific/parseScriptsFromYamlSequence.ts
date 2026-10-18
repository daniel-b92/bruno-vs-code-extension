import { YAMLMap, YAMLSeq } from "yaml";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedScript,
    ParsedStringScalarWithStyle,
} from "../interfaces";
import { WithKeyAndValueRange, YamlParsingError } from "../../../..";
import { getYamlMapsFromSequence } from "../yamlSequences/getYamlMapsFromSequence";
import {
    ValidatedMapItems,
    getValidatedMapItems,
} from "../yamlMaps/getValidatedMapItems";
import {
    ScriptMapProperty,
    ScriptType,
} from "../../../external/yamlFormat/constants/sharedConstants";
import { getRangeForItem } from "../util/getRangeForItem";
import { getStringWithBlockScalarInfo } from "../util/getStringWithBlockScalarInfo";

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
        const { getString, getEnumValue } = getValidatedMapItems(
            currentMap,
            {
                scalars: {
                    stringValues: keysForStringScalars,
                    enumValues: {
                        [ScriptMapProperty.Type]: Object.values(ScriptType),
                    },
                },
                // All properties are mandatory for scripts.
                mandatoryKeys: keysForStringScalars,
            },
            commonArgs,
            errors,
        );
        const { errors: parsingErrors, result: parsedScript } = parseScript(
            currentMap,
            getString,
            getEnumValue,
        );
        errors.push(...parsingErrors);

        if (!parsedScript) {
            continue;
        }

        const { code, type } = parsedScript;
        scripts.push({
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
    map: YAMLMap,
    getString: ValidatedMapItems["getString"],
    getEnumValue: ValidatedMapItems["getEnumValue"],
): MaybeResultWithErrors<{
    type?: WithKeyAndValueRange<ScriptType>;
    code?: ParsedStringScalarWithStyle;
}> {
    const collectedErrors: YamlParsingError[] = [];
    const maybeCodeWithKeyRange = getString(ScriptMapProperty.Code);

    const maybeTypedType = getEnumValue<ScriptType>(ScriptMapProperty.Type);

    return {
        errors: collectedErrors,
        result: {
            code: getStringWithBlockScalarInfo(
                map,
                ScriptMapProperty.Code,
                maybeCodeWithKeyRange,
            ),
            type: maybeTypedType,
        },
    };
}
