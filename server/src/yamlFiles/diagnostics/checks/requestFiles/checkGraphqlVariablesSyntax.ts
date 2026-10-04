import { ParsedRequestFile, TextDocumentHelper } from "@global_shared";
import { Diagnostic } from "vscode-languageserver";
import { checkJsonScalarSyntax } from "./checkJsonBodySyntax";

export function checkGraphqlVariablesSyntax(
    body: NonNullable<
        ParsedRequestFile["properties"]["graphql"]
    >["properties"]["body"],
    docHelper: TextDocumentHelper,
): Diagnostic | undefined {
    return checkJsonScalarSyntax(body?.properties.variables, docHelper);
}
