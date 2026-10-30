import * as ts from "typescript/lib/tsserverlibrary";

/**
 * Returns the names that are declared in the scope of the given code block (variables, functions and classes),
 * with their offsets relative to the start of the code.
 *
 * `var` declarations within nested blocks (e.g. of an `if` statement) are included as well, since they are hoisted to the function
 * that Bruno executes the code block in. Declarations within nested functions are not included.
 */
export function getTopLevelDeclarations(code: string) {
    const sourceFile = ts.createSourceFile(
        "codeBlock.js",
        code,
        ts.ScriptTarget.ES2020,
        true,
        ts.ScriptKind.JS,
    );
    const declarations: { name: string; start: number; length: number }[] = [];

    const addBindingNames = (name: ts.BindingName) => {
        if (ts.isIdentifier(name)) {
            declarations.push({
                name: name.text,
                start: name.getStart(sourceFile),
                length: name.getWidth(sourceFile),
            });
            return;
        }

        for (const element of name.elements) {
            if (!ts.isOmittedExpression(element)) {
                addBindingNames(element.name);
            }
        }
    };

    const visitNestedNode = (node: ts.Node) => {
        if (ts.isFunctionLike(node) || ts.isClassLike(node)) {
            return;
        }

        if (
            ts.isVariableDeclarationList(node) &&
            !(node.flags & ts.NodeFlags.BlockScoped)
        ) {
            node.declarations.forEach(({ name }) => addBindingNames(name));
        }

        ts.forEachChild(node, visitNestedNode);
    };

    for (const statement of sourceFile.statements) {
        if (ts.isVariableStatement(statement)) {
            statement.declarationList.declarations.forEach(({ name }) =>
                addBindingNames(name),
            );
        } else if (
            (ts.isFunctionDeclaration(statement) ||
                ts.isClassDeclaration(statement)) &&
            statement.name
        ) {
            addBindingNames(statement.name);
        } else {
            ts.forEachChild(statement, visitNestedNode);
        }
    }

    return declarations;
}
