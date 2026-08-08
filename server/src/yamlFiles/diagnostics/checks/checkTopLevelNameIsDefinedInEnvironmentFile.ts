import { WithKeyAndValueRange } from "@global_shared";
import { Diagnostic } from "vscode-languageserver";
import { CommonDiagnosticParams } from "../../interfaces";
import { getErrorForMissingTopLevelKey } from "../util/getErrorForMissingTopLevelKey";

export function checkTopLevelNameIsDefinedInEnvironmentFile(
    parsingResult: {
        name:
            | WithKeyAndValueRange<string>
            | {
                  missing: boolean;
              };
    },
    commonParams: CommonDiagnosticParams,
): Diagnostic | undefined {
    return "missing" in parsingResult.name &&
        parsingResult.name.missing === true
        ? getErrorForMissingTopLevelKey("name", commonParams)
        : undefined;
}
