import {
    TopLevelEnvironmentFileProperty,
    WithKeyAndValueRange,
} from "@global_shared";
import { Diagnostic } from "vscode-languageserver";
import { CommonDiagnosticParams } from "../../../interfaces";
import { getErrorForMissingTopLevelKey } from "../../util/getErrorForMissingTopLevelKey";
import { ParsedYamlMap } from "@global_shared/fileParsing/internal/yamlFormat/interfaces";

export function checkTopLevelNameIsDefined(
    {
        missingProperties,
    }: ParsedYamlMap<{
        name?: WithKeyAndValueRange<string>;
    }>,
    commonParams: CommonDiagnosticParams,
): Diagnostic | undefined {
    return missingProperties.some(
        ({ key }) => key == TopLevelEnvironmentFileProperty.Name,
    )
        ? getErrorForMissingTopLevelKey(
              TopLevelEnvironmentFileProperty.Name,
              commonParams,
          )
        : undefined;
}
