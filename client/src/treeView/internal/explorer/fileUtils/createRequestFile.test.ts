import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { commands, window } from "vscode";
import {
    CollectionFormat,
    RequestFileBlockName,
    RequestType,
} from "@global_shared";
import {
    createCollectionWithEnvironments,
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
        expect(
            await readFile(join(directory, "my_request.yml"), "utf-8"),
        ).toBe(
            [
                "info:",
                "  name: my_request",
                "  type: http",
                "  seq: 1",
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
                "grpc:",
                '  url: ""',
                "",
            ].join("\n"),
        );
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

    const quickPick = createFakeQuickPick();
    jest.spyOn(window, "createQuickPick").mockReturnValue(quickPick as never);

    await createRequestFile(
        createItemProvider(directory, format),
        {
            waitForFileToBeRegisteredInCache: async () => {},
        } as unknown as FileSystemCacheSyncingHelper,
        { getPath: () => directory } as BrunoTreeItem,
    );

    for (const label of pickedLabels) {
        await quickPick.select(label);
    }
}

async function getNameValidator(directory: string, format: CollectionFormat) {
    const showInputBox = jest
        .spyOn(window, "showInputBox")
        .mockResolvedValue(undefined);
    jest.spyOn(window, "createQuickPick").mockReturnValue(
        createFakeQuickPick() as never,
    );

    await createRequestFile(
        createItemProvider(directory, format),
        {} as FileSystemCacheSyncingHelper,
        { getPath: () => directory } as BrunoTreeItem,
    );

    const options = showInputBox.mock.calls[0][0] as unknown as {
        validateInput: (value: string) => Promise<string | undefined>;
    };

    return options.validateInput;
}

function createItemProvider(directory: string, format: CollectionFormat) {
    const collection = createCollectionWithEnvironments([], directory, format);

    return {
        getAncestorCollectionForPath: () => collection,
    } as unknown as TypedCollectionItemProvider;
}

function createFakeQuickPick() {
    let selectionListener: (picks: { label: string }[]) => Promise<void> =
        async () => {};

    return {
        items: [] as { label: string }[],
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
