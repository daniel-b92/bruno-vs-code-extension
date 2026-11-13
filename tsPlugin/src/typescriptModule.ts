import type * as ts from "typescript/lib/tsserverlibrary";

let typescriptModule: typeof ts | undefined;

/**
 * The plugin doesn't ship its own copy of Typescript, but uses the one of the Typescript server that loads it.
 * Besides saving space, this makes sure that the plugin always works with the same version as the server (e.g. regarding the values of `SyntaxKind`).
 * `typescript` is only a dev dependency for the types, so apart from `import type`, the module must only be accessed via `getTypescript`.
 */
export function setTypescript(module: typeof ts) {
    typescriptModule = module;
}

export function getTypescript(): typeof ts {
    if (!typescriptModule) {
        throw new Error(
            "The Typescript module has not been set yet. It is passed to the plugin by the Typescript server when initializing it.",
        );
    }

    return typescriptModule;
}
