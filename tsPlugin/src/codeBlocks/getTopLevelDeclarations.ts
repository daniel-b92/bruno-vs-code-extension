import type * as ts from "typescript/lib/tsserverlibrary";
import { getTypescript } from "../typescriptModule";

/**
 * Returns the names that are declared in the scope of the given code block (variables, functions and classes),
 * with their offsets relative to the start of the code.
 *
 * `var` declarations within nested blocks (e.g. of an `if` statement) are included as well, since they are hoisted to the function
 * that Bruno executes the code block in. Declarations within nested functions are not included.
 */
export function getTopLevelDeclarations(code: string) {
    const sourceFile = getTypescript().createSourceFile(
        "codeBlock.js",
        code,
        getTypescript().ScriptTarget.ES2020,
        true,
        getTypescript().ScriptKind.JS,
    );
    const declarations: { name: string; start: number; length: number }[] = [];

    const addBindingNames = (name: ts.BindingName) => {
        if (getTypescript().isIdentifier(name)) {
            declarations.push({
                name: name.text,
                start: name.getStart(sourceFile),
                length: name.getWidth(sourceFile),
            });
            return;
        }

        for (const element of name.elements) {
            if (!getTypescript().isOmittedExpression(element)) {
                addBindingNames(element.name);
            }
        }
    };

    const visitNestedNode = (node: ts.Node) => {
        if (
            getTypescript().isFunctionLike(node) ||
            getTypescript().isClassLike(node)
        ) {
            return;
        }

        if (
            getTypescript().isVariableDeclarationList(node) &&
            !(node.flags & getTypescript().NodeFlags.BlockScoped)
        ) {
            node.declarations.forEach(({ name }) => addBindingNames(name));
        }

        getTypescript().forEachChild(node, visitNestedNode);
    };

    for (const statement of sourceFile.statements) {
        if (getTypescript().isVariableStatement(statement)) {
            statement.declarationList.declarations.forEach(({ name }) =>
                addBindingNames(name),
            );
        } else if (
            (getTypescript().isFunctionDeclaration(statement) ||
                getTypescript().isClassDeclaration(statement)) &&
            statement.name
        ) {
            addBindingNames(statement.name);
        } else {
            getTypescript().forEachChild(statement, visitNestedNode);
        }
    }

    return declarations;
}
