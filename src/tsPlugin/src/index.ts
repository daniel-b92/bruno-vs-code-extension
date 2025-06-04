import { extname } from "path";
import * as ts from "typescript/lib/tsserverlibrary";

function init(_modules: {
    typescript: typeof import("typescript/lib/tsserverlibrary");
}) {
    function create(info: ts.server.PluginCreateInfo) {
        // Set up decorator object
        const proxy: ts.LanguageService = Object.create(null);

        for (const k of Object.keys(
            info.languageService
        ) as (keyof ts.LanguageService)[]) {
            const x = info.languageService[k]!;
            // @ts-expect-error - JS runtime trickery which is tricky to type tersely
            proxy[k] = (...args: unknown[]) => x.apply(info.languageService, args);
        }

        proxy.getSyntacticDiagnostics = (fileName) => {
            return isBrunoFile(fileName)
                ? []
                : info.languageService.getSyntacticDiagnostics(fileName);
        };

        proxy.getSemanticDiagnostics = (fileName) => {
            return isBrunoFile(fileName)
                ? []
                : info.languageService.getSemanticDiagnostics(fileName);
        };

        proxy.getQuickInfoAtPosition = (fileName, position) => {
            return isBrunoFile(fileName)
                ? undefined
                : info.languageService.getQuickInfoAtPosition(
                      fileName,
                      position
                  );
        };

        return proxy;
    }

    return {
        create,
    };
}

function isBrunoFile(fileName: string) {
    return extname(fileName) == ".bru";
}

export = init;
