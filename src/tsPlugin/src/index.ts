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

        proxy.getCompletionsAtPosition = (fileName, position, options) => {
            if (extname(fileName) != ".bru") {
                return info.languageService.getCompletionsAtPosition(
                    fileName,
                    position,
                    options
                );
            }

            if (extname(fileName) == ".bru") {
                return getCompletionItemsForBruFile(
                    info.languageService,
                    fileName,
                    position
                );
            }
        };

        return proxy;
    }

    return {
        create,
    };
}

function getCompletionItemsForBruFile(
    service: ts.LanguageService,
    bruFileName: string,
    offsetInBruFile: number
) {
    const virtualFileName = getVirtualJsFileName(bruFileName);

    return service.getCompletionsAtPosition(
        virtualFileName,
        offsetInBruFile,
        {}
    );
}

function getVirtualJsFileName(bruFileName: string) {
    return bruFileName.replace(extname(bruFileName), ".js");
}

export = init;
