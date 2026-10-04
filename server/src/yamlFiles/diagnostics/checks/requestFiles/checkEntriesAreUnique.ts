import { ParsedRequestFile } from "@global_shared";
import { Diagnostic } from "vscode-languageserver";
import { CommonDiagnosticParams } from "../../../interfaces";
import { checkNamePropertyIsUniqueAcrossMaps } from "../../shared/checkNamePropertyIsUniqueAcrossMaps";
import { checkTypePropertyIsUniqueAcrossMaps } from "../../shared/checkTypePropertyIsUniqueAcrossMaps";
import { checkHeaderNamesAreUnique } from "../../shared/checkHeaderNamesAreUnique";
import { checkCombinationOfPropertiesIsUnique } from "../../shared/generic/checkCombinationOfPropertiesIsUnique";

export function checkEntriesAreUnique(
    { http, graphql, runtime }: ParsedRequestFile["properties"],
    commonParams: CommonDiagnosticParams,
): (Diagnostic | undefined)[] {
    const { filePath } = commonParams;

    const headers = (http ?? graphql)?.properties.headers?.enabled;
    const params = http?.properties.params?.enabled;
    const { variables, scripts, assertions, actions } =
        runtime?.properties ?? {};

    return [
        ...(headers ? checkHeaderNamesAreUnique(headers, filePath) : []),
        ...(params
            ? checkCombinationOfPropertiesIsUnique(
                  filePath,
                  params.flatMap(
                      ({ valueRange, properties: { type, name, value } }) =>
                          type && name
                              ? {
                                    // Query params can be repeated with different values.
                                    values: [
                                        type.value,
                                        name.value,
                                        value?.value ?? "",
                                    ],
                                    range: valueRange,
                                }
                              : [],
                  ),
                  ["type", "name", "value"],
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
                  assertions.enabled.flatMap(
                      ({
                          valueRange,
                          properties: { expression, operator, value },
                      }) =>
                          expression && operator
                              ? {
                                    values: [
                                        expression.value,
                                        operator.value,
                                        value?.value ?? "",
                                    ],
                                    range: valueRange,
                                }
                              : [],
                  ),
                  ["expression", "operator", "value"],
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
