import { ParsedRequestFile, TextDocumentHelper } from "@global_shared";
import { Diagnostic } from "vscode-languageserver";
import { checkJsonScalarSyntax } from "./checkJsonBodySyntax";

export function checkGraphqlVariablesSyntax(
    body: NonNullable<
        ParsedRequestFile["properties"]["graphql"]
    >["properties"]["body"],
    docHelper: TextDocumentHelper,
): Diagnostic | undefined {
    const variables = body?.properties.variables;

    // Empty variables are valid for GraphQL requests (they are treated as an empty object).
    return variables?.value.trim()
        ? checkJsonScalarSyntax(variables, docHelper)
        : undefined;
}
