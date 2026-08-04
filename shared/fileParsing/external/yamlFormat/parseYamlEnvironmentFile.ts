import { LineCounter, parseDocument, YAMLMap } from "yaml";
import { TextDocumentHelper, YamlParsingError } from "../../..";
import { getScalarFieldStringValueFromMap } from "../../internal/yamlFormat/yamlMaps/getScalarFieldStringValueFromMap";
import { mapErrors } from "../../internal/yamlFormat/util/mapErrors";
import { getTopLevelMapIfExists } from "../../internal/yamlFormat/yamlMaps/getTopLevelMapIfExists";
import { getYamlSequenceByKeyFromMap } from "../../internal/yamlFormat/yamlMaps/getYamlSequenceByKeyFromMap";
import { getYamlMapsFromSequence } from "../../internal/yamlFormat/yamlSequences/getYamlMapsFromSequence";
import { CommonParsingArgs } from "../../internal/yamlFormat/interfaces";

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
}

enum VariableValueProperty {
    Type = "type",
    Data = "data",
}

enum VariableType {
    Number = "number",
    Boolean = "boolean",
    Object = "object",
}

interface Variable {
    name: string;
    value?: string | { type: VariableType; data: string };
    description?: string;
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

    return {
        name: maybeNameField.value,
        variables: variableItems,
        errors,
    };
}
