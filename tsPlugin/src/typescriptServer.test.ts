import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
    mkdirSync,
    mkdtempSync,
    realpathSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import * as ts from "typescript/lib/tsserverlibrary";
import init = require("./index");

/**
 * Unlike the other tests (which use a language service with a mocked host), these tests use the project service of the Typescript server
 * with the real file system and real file watchers, like VS Code does. The plugin is loaded from the sources, so no build is needed.
 */
describe("plugin within the Typescript server", () => {
    let server: TypescriptServer;

    beforeEach(() => {
        server = new TypescriptServer();
    });

    afterEach(() => {
        server.dispose();
    });

    it("provides the runtime types and diagnostics for code blocks in bru files", () => {
        server.writeFiles({
            "collection/bruno.json": '{ "type": "collection" }',
            "collection/request.bru": `meta {
  name: request
}

script:pre-request {
  valeu;
  res.status;
  bru.getEnvVar("a");
}

tests {
  res.status;
}
`,
        });
        server.configurePlugin({});
        server.open("collection/request.bru");

        expect(server.getDiagnostics("collection/request.bru")).toEqual([
            // Cannot find name 'valeu'.
            { code: 2_304, text: "valeu" },
            // 'res' is possibly 'undefined'.
            { code: 18_048, text: "res" },
        ]);
        expect(server.getHover("collection/request.bru", "bru.")).toContain(
            "getEnvVar",
        );
    });

    it("resolves the types for `expect` from the `node_modules` of the collection", () => {
        server.writeFiles({
            "collection/bruno.json": '{ "type": "collection" }',
            "collection/request.bru": `tests {
  expect(1).to.equal(1);
}
`,
        });
        server.linkPackageFromRepository("collection", "@types/chai");
        server.configurePlugin({});
        server.open("collection/request.bru");

        expect(server.getDiagnostics("collection/request.bru")).toEqual([]);
        expect(server.getHover("collection/request.bru", "expect(")).toContain(
            "Chai",
        );
    });

    it("resolves imports in bru files relative to the root folder of the collection", () => {
        server.writeFiles({
            "collection/bruno.json": '{ "type": "collection" }',
            "collection/lib/helper.js": "module.exports = { helper: () => 1 };",
            "collection/requests/request.bru": `script:pre-request {
  const lib = require("./lib/helper");
  lib.missing();
}
`,
        });
        server.configurePlugin({});
        server.open("collection/requests/request.bru");

        expect(
            server.getDiagnostics("collection/requests/request.bru"),
        ).toEqual([
            // Property 'missing' does not exist on type '{ helper: () => number; }'.
            { code: 2_339, text: "missing" },
        ]);
    });

    it("provides the runtime types for scripts in Yaml collections", () => {
        server.writeFiles({
            "collection/opencollection.yml": "opencollection: 1.0.0\n",
            "collection/request.yml": `info:
  name: request
runtime:
  scripts:
    - type: before-request
      code: |-
        valeu;
        bru.missing();
`,
        });
        server.configurePlugin({ yamlCollectionSupport: true });
        server.open("collection/request.yml");

        expect(server.getDiagnostics("collection/request.yml")).toEqual([
            { code: 2_304, text: "valeu" },
            // Property 'missing' does not exist on the type of 'bru'.
            { code: 2_339, text: "missing" },
        ]);
    });

    describe("additional context roots", () => {
        const files = {
            "collection/bruno.json": '{ "type": "collection" }',
            "shared/script.js": "// @ts-check\nbru.missing();\n",
        };

        it("uses the roots that are configured before the project is created", () => {
            server.writeFiles(files);
            server.configurePlugin({
                additionalContextRoots: [server.getPath("shared")],
            });
            server.open("shared/script.js");

            expect(server.getDiagnostics("shared/script.js")).toEqual([
                { code: 2_339, text: "missing" },
            ]);
        });

        it("applies changes of the roots to projects that already exist", () => {
            server.writeFiles(files);
            server.configurePlugin({});
            server.open("shared/script.js");

            expect(server.getDiagnostics("shared/script.js")).toEqual([
                // Cannot find name 'bru'.
                { code: 2_304, text: "bru" },
            ]);

            server.configurePlugin({
                additionalContextRoots: [server.getPath("shared")],
            });

            expect(server.getDiagnostics("shared/script.js")).toEqual([
                { code: 2_339, text: "missing" },
            ]);
        });
    });

    it("detects a collection whose root file is created after the request file has been opened", async () => {
        const requestFile = "collection/request.bru";
        server.writeFiles({
            [requestFile]: "script:pre-request {\n  bru.missing();\n}\n",
        });
        server.configurePlugin({});
        server.open(requestFile);

        expect(server.getDiagnostics(requestFile)).toEqual([]);

        server.writeFiles({ "collection/bruno.json": '{ "type": "other" }' });
        server.writeFiles({
            "collection/bruno.json": '{ "type": "collection" }',
        });

        await waitUntil(() => server.getDiagnostics(requestFile).length > 0);
        expect(server.getDiagnostics(requestFile)).toEqual([
            { code: 2_339, text: "missing" },
        ]);
    });

    it("adds collection files to a configured project that allows Javascript", async () => {
        const requestFile = "collection/request.bru";
        server.writeFiles({
            "collection/bruno.json": '{ "type": "collection" }',
            "collection/tsconfig.json": JSON.stringify({
                compilerOptions: { allowJs: true, checkJs: true, strict: true },
            }),
            [requestFile]: `script:pre-request {
  /** @type {string} */
  const name = null;
}
`,
        });
        server.configurePlugin({});
        server.open(requestFile);

        // The extensions for collection files are registered with a delay, which reloads the projects.
        await waitUntil(
            () =>
                server.getConfigFileOfProject(requestFile) ==
                server.getPath("collection/tsconfig.json"),
        );
        expect(server.getDiagnostics(requestFile)).toEqual([
            // Type 'null' is not assignable to type 'string' (only reported with `strict`).
            { code: 2_322, text: "name" },
        ]);
    });
});

interface Diagnostic {
    code: number;
    text: string;
}

class TypescriptServer {
    private readonly folder = realpathSync(
        mkdtempSync(join(tmpdir(), "bruno-ts-plugin-")),
    );
    private readonly watchers: ts.FileWatcher[] = [];
    private readonly timeouts = new Set<NodeJS.Timeout>();
    private readonly session: ts.server.Session;
    private seq = 0;

    constructor() {
        const trackWatcher = (watcher: ts.FileWatcher) => {
            let isClosed = false;
            const closeOnce = {
                close: () => {
                    if (!isClosed) {
                        isClosed = true;
                        watcher.close();
                    }
                },
            };
            this.watchers.push(closeOnce);
            return closeOnce;
        };
        const host: ts.server.ServerHost = {
            ...ts.sys,
            watchFile: (...args) => trackWatcher(ts.sys.watchFile!(...args)),
            watchDirectory: (...args) =>
                trackWatcher(ts.sys.watchDirectory!(...args)),
            // The responses of the session are not needed.
            write: () => {},
            // The plugin defers some work. Pending timeouts must not run after the test has finished.
            setTimeout: (callback, ms, ...args) => {
                const timeout = setTimeout(() => {
                    this.timeouts.delete(timeout);
                    callback(...args);
                }, ms);
                this.timeouts.add(timeout);
                return timeout;
            },
            clearTimeout: (timeout) => {
                this.timeouts.delete(timeout);
                clearTimeout(timeout);
            },
            setImmediate,
            clearImmediate,
            require: (_initialPath, moduleName) =>
                moduleName == pluginName
                    ? { module: init, error: undefined }
                    : {
                          module: undefined,
                          error: { message: `Unknown plugin '${moduleName}'` },
                      },
        };

        this.session = new ts.server.Session({
            host,
            cancellationToken: ts.server.nullCancellationToken,
            useSingleInferredProject: false,
            // Like VS Code does.
            useInferredProjectPerProjectRoot: true,
            byteLength: Buffer.byteLength,
            hrtime: process.hrtime,
            logger: createLogger(),
            canUseEvents: false,
            globalPlugins: [pluginName],
            // Avoid waiting for the throttled updates of the projects after file changes.
            throttleWaitMilliseconds: 0,
        });
    }

    getPath(relativePath: string) {
        return ts.server.toNormalizedPath(join(this.folder, relativePath));
    }

    writeFiles(files: Record<string, string>) {
        for (const [relativePath, content] of Object.entries(files)) {
            const path = join(this.folder, relativePath);
            mkdirSync(dirname(path), { recursive: true });
            writeFileSync(path, content);
        }
    }

    /**
     * Installing packages in the test folder would take too long, so the package of the repository is linked instead.
     */
    linkPackageFromRepository(folder: string, packageName: string) {
        const target = join(this.folder, folder, "node_modules", packageName);
        mkdirSync(dirname(target), { recursive: true });
        // Junctions do not need extra permissions on Windows.
        symlinkSync(
            resolve(__dirname, "../../node_modules", packageName),
            target,
            "junction",
        );
    }

    configurePlugin(configuration: object) {
        this.execute(ts.server.protocol.CommandTypes.ConfigurePlugin, {
            pluginName,
            configuration,
        });
    }

    open(relativePath: string) {
        this.execute(ts.server.protocol.CommandTypes.Open, {
            file: this.getPath(relativePath),
            projectRootPath: this.folder,
        });
    }

    getDiagnostics(relativePath: string): Diagnostic[] {
        const file = this.getPath(relativePath);
        const content = ts.sys.readFile(file) ?? "";

        return [
            ts.server.protocol.CommandTypes.SyntacticDiagnosticsSync,
            ts.server.protocol.CommandTypes.SemanticDiagnosticsSync,
        ].flatMap((command) =>
            (
                this.execute(command, {
                    file,
                    includeLinePosition: true,
                }) as ts.server.protocol.DiagnosticWithLinePosition[]
            ).map(({ code, start, length }) => ({
                code,
                text: content.substring(start, start + length),
            })),
        );
    }

    /**
     * Returns the hover for the position at the end of the given text.
     */
    getHover(relativePath: string, textBeforePosition: string) {
        const file = this.getPath(relativePath);
        const content = ts.sys.readFile(file) ?? "";
        const index = content.indexOf(textBeforePosition);

        if (index < 0) {
            throw new Error(`Text '${textBeforePosition}' not found.`);
        }

        const response = this.execute(
            ts.server.protocol.CommandTypes.Quickinfo,
            {
                file,
                position: index + textBeforePosition.length - 1,
            },
        ) as ts.server.protocol.QuickInfoResponseBody | undefined;

        return response?.displayString ?? "";
    }

    getConfigFileOfProject(relativePath: string) {
        const response = this.execute(
            ts.server.protocol.CommandTypes.ProjectInfo,
            { file: this.getPath(relativePath), needFileNameList: false },
        ) as ts.server.protocol.ProjectInfo;

        return response.configFileName;
    }

    dispose() {
        this.timeouts.forEach((timeout) => clearTimeout(timeout));
        this.timeouts.clear();
        this.watchers.forEach((watcher) => watcher.close());
        rmSync(this.folder, { recursive: true, force: true });
    }

    private execute(command: string, args: object) {
        const { response } = this.session.executeCommand({
            seq: ++this.seq,
            type: "request",
            command,
            arguments: args,
        });

        return response;
    }
}

const pluginName = "typescript-for-bruno";

function createLogger(): ts.server.Logger {
    return {
        close: () => {},
        hasLevel: () => false,
        loggingEnabled: () => false,
        perftrc: () => {},
        info: () => {},
        startGroup: () => {},
        endGroup: () => {},
        msg: () => {},
        getLogFileName: () => undefined,
    };
}

async function waitUntil(condition: () => boolean, timeoutInMs = 10_000) {
    const start = Date.now();

    while (!condition()) {
        if (Date.now() - start > timeoutInMs) {
            throw new Error(`Condition not met within ${timeoutInMs} ms.`);
        }

        await new Promise((resolve) => setTimeout(resolve, 50));
    }
}
