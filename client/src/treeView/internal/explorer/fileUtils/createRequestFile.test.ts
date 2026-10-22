import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { commands, window, workspace } from "vscode";
import {
    CollectionFormat,
    RequestFileBlockName,
    RequestType,
} from "@global_shared";
import {
    createItemProviderStub,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import {
    BrunoTreeItem,
    FileSystemCacheSyncingHelper,
    TypedCollectionItemProvider,
} from "@shared";
import { createRequestFile } from "./createRequestFile";

describe("createRequestFile", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("creates a bru request file with meta and method block", async () => {
        const directory = await createTemporaryDirectory();

        await runCreateRequestFile(directory, CollectionFormat.Bru, {
            requestName: "my_request",
            pickedLabels: [RequestType.Http, RequestFileBlockName.Post],
        });

        expect(await readdir(directory)).toEqual(["my_request.bru"]);

        const content = await readFile(
            join(directory, "my_request.bru"),
            "utf-8",
        );

        expect(content).toContain("name: my_request");
        expect(content).toContain("type: http");
        expect(content).toContain("seq: 1");
        expect(content).toContain("post {");
    });

    it("creates a yaml request file for an http request", async () => {
        const directory = await createTemporaryDirectory();

        await runCreateRequestFile(directory, CollectionFormat.Yaml, {
            requestName: "my_request",
            pickedLabels: [RequestType.Http, RequestFileBlockName.Post],
        });

        expect(await readdir(directory)).toEqual(["my_request.yml"]);
        expect(await readFile(join(directory, "my_request.yml"), "utf-8")).toBe(
            [
                "info:",
                "  name: my_request",
                "  type: http",
                "  seq: 1",
                "",
                "http:",
                "  method: POST",
                '  url: ""',
                "",
            ].join("\n"),
        );
    });

    it("creates a yaml request file for a gRPC request without a method", async () => {
        const directory = await createTemporaryDirectory();

        await runCreateRequestFile(directory, CollectionFormat.Yaml, {
            requestName: "grpc_request",
            pickedLabels: [RequestType.Grpc],
        });

        expect(
            await readFile(join(directory, "grpc_request.yml"), "utf-8"),
        ).toBe(
            [
                "info:",
                "  name: grpc_request",
                "  type: grpc",
                "  seq: 1",
                "",
                "grpc:",
                '  url: ""',
                "",
            ].join("\n"),
        );
    });

    it("creates a yaml request file for a websocket request with the yaml type and without a method", async () => {
        const directory = await createTemporaryDirectory();

        await runCreateRequestFile(directory, CollectionFormat.Yaml, {
            requestName: "ws_request",
            pickedLabels: [RequestType.Ws],
        });

        expect(await readFile(join(directory, "ws_request.yml"), "utf-8")).toBe(
            [
                "info:",
                "  name: ws_request",
                "  type: websocket",
                "  seq: 1",
                "",
                "websocket:",
                '  url: ""',
                "",
            ].join("\n"),
        );
    });

    it("uses a sequence after the ones of existing request files and app files", async () => {
        const directory = await createTemporaryDirectory({
            "existing_request.bru":
                "meta {\n  name: existing_request\n  type: http\n  seq: 2\n}\n",
            "app.bru": "meta {\n  name: app\n  type: app\n  seq: 4\n}\n",
        });

        await runCreateRequestFile(directory, CollectionFormat.Bru, {
            requestName: "my_request",
            pickedLabels: [RequestType.Http, RequestFileBlockName.Post],
        });

        expect(
            await readFile(join(directory, "my_request.bru"), "utf-8"),
        ).toContain("seq: 5");
    });

    it("uses the request URL from the presets for any request type and creates matching params blocks (bru)", async () => {
        const directory = await createTemporaryDirectory({
            "bruno.json": JSON.stringify({
                presets: {
                    requestType: "graphql",
                    requestUrl: "{{baseUrl}}/users/:id?limit=10&sort=asc",
                },
            }),
        });

        await runCreateRequestFile(directory, CollectionFormat.Bru, {
            requestName: "my_request",
            pickedLabels: [RequestType.Http, RequestFileBlockName.Get],
        });

        expect(await readFile(join(directory, "my_request.bru"), "utf-8")).toBe(
            [
                "meta {",
                "  name: my_request",
                "  type: http",
                "  seq: 1",
                "}",
                "",
                "get {",
                "  url: {{baseUrl}}/users/:id?limit=10&sort=asc",
                "  body: none",
                "  auth: none",
                "}",
                "",
                "params:query {",
                "  limit: 10",
                "  sort: asc",
                "}",
                "",
                "params:path {",
                "  id: ",
                "}",
                "",
            ].join("\n"),
        );
    });

    it("uses the request URL from the presets and creates matching params for an http request (yaml)", async () => {
        const directory = await createTemporaryDirectory({
            "opencollection.yml": [
                "extensions:",
                "  bruno:",
                "    presets:",
                "      request:",
                "        type: http",
                "        url: https://example.com/users/:id?limit=10",
                "",
            ].join("\n"),
        });

        await runCreateRequestFile(directory, CollectionFormat.Yaml, {
            requestName: "my_request",
            pickedLabels: [RequestType.Http, RequestFileBlockName.Get],
        });

        expect(await readFile(join(directory, "my_request.yml"), "utf-8")).toBe(
            [
                "info:",
                "  name: my_request",
                "  type: http",
                "  seq: 1",
                "",
                "http:",
                "  method: GET",
                "  url: https://example.com/users/:id?limit=10",
                "  params:",
                "    - name: limit",
                '      value: "10"',
                "      type: query",
                "    - name: id",
                '      value: ""',
                "      type: path",
                "",
            ].join("\n"),
        );
    });

    it("does not create params for websocket requests", async () => {
        const directory = await createTemporaryDirectory({
            "bruno.json": JSON.stringify({
                presets: { requestUrl: "ws://localhost/:id?a=b" },
            }),
        });

        await runCreateRequestFile(directory, CollectionFormat.Bru, {
            requestName: "ws_request",
            pickedLabels: [RequestType.Ws],
        });

        const content = await readFile(
            join(directory, "ws_request.bru"),
            "utf-8",
        );

        expect(content).toContain("url: ws://localhost/:id?a=b");
        expect(content).not.toContain("params:");
    });

    it("preselects the request type from the presets", async () => {
        const directory = await createTemporaryDirectory({
            "bruno.json": JSON.stringify({
                presets: { requestType: "graphql" },
            }),
        });

        const { quickPick } = await runCreateRequestFile(
            directory,
            CollectionFormat.Bru,
            { requestName: "my_request", pickedLabels: [] },
        );

        expect(quickPick.activeItems).toEqual([{ label: RequestType.Graphql }]);
    });

    it("preselects no request type without presets", async () => {
        const directory = await createTemporaryDirectory();

        const { quickPick } = await runCreateRequestFile(
            directory,
            CollectionFormat.Bru,
            { requestName: "my_request", pickedLabels: [] },
        );

        expect(quickPick.activeItems).toEqual([]);
    });

    it("validates the new name against the extension of the collection format", async () => {
        const directory = await createTemporaryDirectory({
            "existing.yml": "",
            "other.bru": "",
        });

        const validateInput = await getNameValidator(
            directory,
            CollectionFormat.Yaml,
        );

        expect(await validateInput("existing")).toContain("already exists");
        expect(await validateInput("other")).toBeUndefined();
    });

    it("does not create a file when no collection can be determined", async () => {
        const directory = await createTemporaryDirectory();
        const showErrorMessage = jest
            .spyOn(window, "showErrorMessage")
            .mockResolvedValue(undefined);
        const showInputBox = jest.spyOn(window, "showInputBox");

        await createRequestFile(
            {
                getAncestorCollectionForPath: () => undefined,
            } as unknown as TypedCollectionItemProvider,
            {} as FileSystemCacheSyncingHelper,
            { getPath: () => directory } as BrunoTreeItem,
        );

        expect(showErrorMessage).toHaveBeenCalledTimes(1);
        expect(showInputBox).not.toHaveBeenCalled();
        expect(await readdir(directory)).toEqual([]);
    });
});

async function runCreateRequestFile(
    directory: string,
    format: CollectionFormat,
    {
        requestName,
        pickedLabels,
    }: { requestName: string; pickedLabels: string[] },
) {
    jest.spyOn(window, "showInputBox").mockResolvedValue(requestName);
    jest.spyOn(commands, "executeCommand").mockResolvedValue(undefined);
    // Use a fixed line break, so that the tests do not depend on the platform.
    jest.spyOn(workspace, "getConfiguration").mockReturnValue({
        get: () => "\n",
    } as never);

    const quickPick = createFakeQuickPick();
    jest.spyOn(window, "createQuickPick").mockReturnValue(quickPick as never);

    await createRequestFile(
        createItemProviderStub<TypedCollectionItemProvider>(directory, format),
        {
            waitForFileToBeRegisteredInCache: async () => {},
        } as unknown as FileSystemCacheSyncingHelper,
        { getPath: () => directory } as BrunoTreeItem,
    );

    for (const label of pickedLabels) {
        await quickPick.select(label);
    }

    return { quickPick };
}

async function getNameValidator(directory: string, format: CollectionFormat) {
    const showInputBox = jest
        .spyOn(window, "showInputBox")
        .mockResolvedValue(undefined);
    jest.spyOn(window, "createQuickPick").mockReturnValue(
        createFakeQuickPick() as never,
    );

    await createRequestFile(
        createItemProviderStub<TypedCollectionItemProvider>(directory, format),
        {} as FileSystemCacheSyncingHelper,
        { getPath: () => directory } as BrunoTreeItem,
    );

    const options = showInputBox.mock.calls[0][0] as unknown as {
        validateInput: (value: string) => Promise<string | undefined>;
    };

    return options.validateInput;
}

function createFakeQuickPick() {
    let selectionListener: (
        picks: { label: string }[],
    ) => Promise<void> = async () => {};

    return {
        items: [] as { label: string }[],
        activeItems: [] as { label: string }[],
        onDidChangeSelection: (
            listener: (picks: { label: string }[]) => Promise<void>,
        ) => {
            selectionListener = listener;
        },
        show: () => {},
        hide: () => {},
        dispose: () => {},
        select: (label: string) => selectionListener([{ label }]),
    };
}
