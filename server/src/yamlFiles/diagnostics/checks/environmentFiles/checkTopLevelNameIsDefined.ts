import { YamlMapMissingPropertyInfo } from "@global_shared";
import { Diagnostic } from "vscode-languageserver";
import { CommonDiagnosticParams } from "../../../interfaces";
import { getErrorForMissingTopLevelKey } from "../../util/getErrorForMissingTopLevelKey";
import { TopLevelEnvironmentFileProperty } from "../../../../../../shared/fileParsing/external/yamlFormat/constants/environmentFileConstants";

export function checkTopLevelNameIsDefined(
    missingProperties: YamlMapMissingPropertyInfo[],
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
