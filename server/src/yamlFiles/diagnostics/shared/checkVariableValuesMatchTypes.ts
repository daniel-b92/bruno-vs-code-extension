import { WithKeyAndValueRange } from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { CommonDiagnosticParams } from "../../interfaces";
import { URI } from "vscode-uri";
import { VariableType } from "../../../../../shared/fileParsing/external/yamlFormat/constants/sharedConstants";

export function checkVariableTypesMatchValueData(
    variables: {
        properties: {
            value?:
                | WithKeyAndValueRange<string>
                | {
                      properties: {
                          type?: WithKeyAndValueRange<VariableType>;
                          data?: WithKeyAndValueRange<string>;
                      };
                  };
        };
    }[],
    { filePath }: CommonDiagnosticParams,
): Diagnostic[] {
    const valuesToCheck = variables
        .map(({ properties: { value } }) =>
            value &&
            "properties" in value &&
            value.properties.data &&
            value.properties.type
                ? (value.properties as {
                      type: WithKeyAndValueRange<VariableType>;
                      data: WithKeyAndValueRange<string>;
                  })
                : undefined,
        )
        .filter((val) => val != undefined);

    return valuesToCheck
        .filter(({ data, type }) => !isValid(data.value, type.value))
        .map(({ data, type }) => ({
            message: `Is not a valid ${type.value}`,
            range: data.valueRange,
            severity: DiagnosticSeverity.Warning,
            relatedInformation: [
                {
                    message: `Type definition`,
                    location: {
                        uri: URI.file(filePath).toString(),
                        range: type.valueRange,
                    },
                },
            ],
        }));
}

function isValid(data: string, type: VariableType) {
    const isBoolean = ["true", "false"].includes(data);
    const isNumber = !isNaN(Number(data));

    switch (type) {
        case VariableType.Boolean:
            return isBoolean;
        case VariableType.Number:
            return isNumber;
        case VariableType.Object:
            try {
                JSON.parse(data);
                // The Bruno desktop app seems to not support the object type for variables that also could be stored as a boolean or a number.
                return !isBoolean && !isNumber;
            } catch {
                return false;
            }
        case VariableType.String:
            return true;
    }
}
