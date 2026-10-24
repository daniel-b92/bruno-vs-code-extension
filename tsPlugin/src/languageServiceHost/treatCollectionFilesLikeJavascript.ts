import { basename } from "path";
import * as ts from "typescript/lib/tsserverlibrary";
import { getRootFolderOfContainingCollection } from "../collection/collectionFormat";
import { hasEmbeddedCodeBlocks } from "../fileTypes";

/**
 * The Typescript server would treat code blocks within `.bru` and Yaml files like Typescript code and resolve imports relative to the file.
 * But at runtime, Bruno executes them like Javascript code and resolves imports relative to the root folder of the collection.
 * Therefore, the following is adjusted for these files:
 * - They are handled as Javascript files (so that e.g. JSDoc types are respected and `require` is treated as an import).
 * - Modules are resolved as if the importing file was located in the collection root folder.
 */
export function treatCollectionFilesLikeJavascript(
    info: ts.server.PluginCreateInfo,
) {
    const host = info.languageServiceHost;

    const getOriginalScriptKind = host.getScriptKind?.bind(host);
    host.getScriptKind = (fileName) =>
        hasEmbeddedCodeBlocks(fileName)
            ? ts.ScriptKind.JS
            : (getOriginalScriptKind?.(fileName) ?? ts.ScriptKind.Unknown);

    const resolveOriginally = getOriginalModuleResolver(host);

    host.resolveModuleNameLiterals = (
        moduleLiterals,
        containingFile,
        redirectedReference,
        options,
        containingSourceFile,
        reusedNames,
    ) => {
        const collectionRoot = hasEmbeddedCodeBlocks(containingFile)
            ? getRootFolderOfContainingCollection(info, containingFile)
            : undefined;

        if (!collectionRoot) {
            return resolveOriginally(
                moduleLiterals,
                containingFile,
                redirectedReference,
                options,
                containingSourceFile,
                reusedNames,
            );
        }

        // The file does not need to exist for resolving the modules relative to its location.
        const fileInCollectionRoot = `${collectionRoot}/${basename(containingFile)}`;

        return moduleLiterals.map((literal) =>
            ts.resolveModuleName(
                literal.text,
                fileInCollectionRoot,
                options,
                host,
                undefined,
                redirectedReference,
                containingSourceFile
                    ? ts.getModeForUsageLocation(
                          containingSourceFile,
                          literal,
                          options,
                      )
                    : undefined,
            ),
        );
    };
}

/**
 * Hosts that do not define their own module resolution use the default one of the Typescript compiler.
 */
function getOriginalModuleResolver(
    host: ts.LanguageServiceHost,
): NonNullable<ts.LanguageServiceHost["resolveModuleNameLiterals"]> {
    if (host.resolveModuleNameLiterals) {
        return host.resolveModuleNameLiterals.bind(host);
    }

    return (
        moduleLiterals,
        containingFile,
        redirectedReference,
        options,
        containingSourceFile,
    ) =>
        moduleLiterals.map((literal) =>
            ts.resolveModuleName(
                literal.text,
                containingFile,
                options,
                host,
                undefined,
                redirectedReference,
                containingSourceFile
                    ? ts.getModeForUsageLocation(
                          containingSourceFile,
                          literal,
                          options,
                      )
                    : undefined,
            ),
        );
}
