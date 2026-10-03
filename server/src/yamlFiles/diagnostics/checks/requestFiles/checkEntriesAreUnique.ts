import { ParsedRequestFile } from "@global_shared";
import { Diagnostic } from "vscode-languageserver";
import { CommonDiagnosticParams } from "../../../interfaces";
import { checkNamePropertyIsUniqueAcrossMaps } from "../../shared/checkNamePropertyIsUniqueAcrossMaps";
import { checkTypePropertyIsUniqueAcrossMaps } from "../../shared/checkTypePropertyIsUniqueAcrossMaps";
import { checkCombinationOfPropertiesIsUnique } from "../../shared/generic/checkCombinationOfPropertiesIsUnique";

export function checkEntriesAreUnique(
    { http, runtime }: ParsedRequestFile["properties"],
    commonParams: CommonDiagnosticParams,
): (Diagnostic | undefined)[] {
    const { filePath } = commonParams;

    const headers = http?.properties.headers?.filter(
        ({ properties: { disabled } }) => !disabled.effectiveValue,
    );
    const params = http?.properties.params?.filter(
        ({ properties: { disabled } }) => !disabled.effectiveValue,
    );
    const { variables, scripts, assertions, actions } =
        runtime?.properties ?? {};

    return [
        ...(headers
            ? checkNamePropertyIsUniqueAcrossMaps(headers, commonParams)
            : []),
        ...(params
            ? checkCombinationOfPropertiesIsUnique(
                  filePath,
                  params.flatMap(
                      ({ valueRange, properties: { type, name } }) =>
                          type && name
                              ? {
                                    values: [type.value, name.value],
                                    range: valueRange,
                                }
                              : [],
                  ),
                  ["type", "name"],
              )
            : []),
        ...(variables
            ? checkNamePropertyIsUniqueAcrossMaps(
                  variables.enabled,
                  commonParams,
              )
            : []),
        ...(scripts
            ? checkTypePropertyIsUniqueAcrossMaps(scripts, commonParams)
            : []),
        ...(assertions
            ? checkCombinationOfPropertiesIsUnique(
                  filePath,
                  assertions.flatMap(
                      ({ valueRange, properties: { expression, operator } }) =>
                          expression && operator
                              ? {
                                    values: [expression.value, operator.value],
                                    range: valueRange,
                                }
                              : [],
                  ),
                  ["expression", "operator"],
              )
            : []),
        ...(actions
            ? checkCombinationOfPropertiesIsUnique(
                  filePath,
                  actions.enabled.flatMap(
                      ({
                          valueRange,
                          properties: { type, phase, selector },
                      }) => {
                          const { expression, method } =
                              selector?.properties ?? {};

                          return type && phase && expression && method
                              ? {
                                    values: [
                                        type.value,
                                        phase.value,
                                        expression.value,
                                        method.value,
                                    ],
                                    range: valueRange,
                                }
                              : [];
                      },
                  ),
                  ["type", "phase", "selector expression", "selector method"],
              )
            : []),
    ];
}
