import { ParsedFolderSettingsFile } from "@global_shared";
import { Diagnostic } from "vscode-languageserver";
import { CommonDiagnosticParams } from "../../interfaces";
import { checkNamePropertyIsUniqueAcrossMaps } from "./checkNamePropertyIsUniqueAcrossMaps";
import { checkVariableTypesMatchValueData } from "./checkVariableValuesMatchTypes";
import { checkTypePropertyIsUniqueAcrossMaps } from "./checkTypePropertyIsUniqueAcrossMaps";
import { checkAuthHasRequiredFields } from "../checks/requestFiles/checkAuthHasRequiredFields";

/**
 * Checks the `request` section, which has the same structure for folder settings files and collection settings files.
 */
export function checkSettingsFileRequestSection(
    request: ParsedFolderSettingsFile["properties"]["request"],
    commonParams: CommonDiagnosticParams,
): (Diagnostic | undefined)[] {
    if (!request) {
        return [];
    }
    const { actions, auth, headers, scripts, variables } = request.properties;

    return [
        checkAuthHasRequiredFields(auth),
        ...(variables
            ? checkNamePropertyIsUniqueAcrossMaps(
                  variables.enabled,
                  commonParams,
              ).concat(
                  checkVariableTypesMatchValueData(
                      variables.enabled,
                      commonParams,
                  ),
              )
            : []),
        ...(headers
            ? checkNamePropertyIsUniqueAcrossMaps(headers, commonParams)
            : []),
        ...(actions
            ? checkTypePropertyIsUniqueAcrossMaps(actions.enabled, commonParams)
            : []),
        ...(scripts
            ? checkTypePropertyIsUniqueAcrossMaps(scripts, commonParams)
            : []),
    ];
}
