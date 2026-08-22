import {
    ParsedEnvironmentVariable,
    WithKeyAndValueRange,
} from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { CommonDiagnosticParams } from "../../../interfaces";

export function checkVariableDefinitionsAreValid(
    variables: ParsedEnvironmentVariable[],
    commonParams: CommonDiagnosticParams,
): (Diagnostic | undefined)[] {
    return variables.flatMap((variable) => {
        const {
            properties: { name, secret },
        } = variable;
        const result: (Diagnostic | undefined)[] = [];

        result.push(
            name ? checkNameIsValid(name) : undefined,
            checkTypeFieldIsValidIfExisting(variable),
        );

        if (secret.effectiveValue) {
            result.push(checkSecretVariableIsValid(variable, commonParams));
        } else {
            // Non-secret variables should always have a value.
            result.push(checkValueFieldExists(variable));
        }

        return result;
    });
}

function checkNameIsValid({
    value,
    valueRange,
}: WithKeyAndValueRange<string>): Diagnostic | undefined {
    return value
        ? undefined
        : {
              message: "Name may not be empty or NULL.",
              range: valueRange,
          };
}

function checkSecretVariableIsValid(
    {
        properties: {
            value,
            secret: { field: secretField },
        },
    }: ParsedEnvironmentVariable,
    { filePath }: CommonDiagnosticParams,
): Diagnostic | undefined {
    if (!value) {
        return undefined;
    }

    const commonPartialResult: Diagnostic = {
        message: "Value field is redundant for secret variable.",
        range: value.keyRange,
        severity: DiagnosticSeverity.Warning,
    };

    return !secretField
        ? { ...commonPartialResult }
        : {
              ...commonPartialResult,
              relatedInformation: [
                  {
                      message: "Secret field",
                      location: {
                          uri: URI.file(filePath).toString(),
                          range: secretField.valueRange,
                      },
                  },
              ],
          };
}

function checkTypeFieldIsValidIfExisting({
    properties: { secret, type },
}: ParsedEnvironmentVariable): Diagnostic | undefined {
    return !secret.effectiveValue && type.field
        ? {
              message: "Type field redundant for non-secret variable.",
              range: type.field.keyRange,
              severity: DiagnosticSeverity.Warning,
          }
        : undefined;
}

function checkValueFieldExists({
    valueRange: variableRange,
    properties: { value },
}: ParsedEnvironmentVariable): Diagnostic | undefined {
    return !value
        ? {
              message: "'value' property is missing.",
              range: variableRange,
          }
        : undefined;
}
