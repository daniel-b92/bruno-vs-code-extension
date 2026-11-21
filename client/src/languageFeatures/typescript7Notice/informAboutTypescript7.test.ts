import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { env, ExtensionContext, extensions, window, workspace } from "vscode";
import { TypedCollectionItemProvider } from "@shared";
import { mockVsCodeSettings } from "../../_testingUtils";
import { informAboutTypescript7 } from "./informAboutTypescript7";
import * as typescript7Check from "./isTypescript7ServerEnabled";

describe("informAboutTypescript7", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("shows the message and logs it once collections are loaded and the Typescript 7 server is used", () => {
        const { show, log } = setUp({ isEnabled: true, hasCollections: true });

        expect(show).toHaveBeenCalledTimes(1);
        expect(show.mock.calls[0][0]).toContain("Typescript 7");
        expect(log).toHaveBeenCalledTimes(1);
    });

    it("shows nothing with the default server", () => {
        const { show, log } = setUp({ isEnabled: false, hasCollections: true });

        expect(show).not.toHaveBeenCalled();
        expect(log).not.toHaveBeenCalled();
    });

    it("shows nothing if there are no collections", () => {
        const { show } = setUp({ isEnabled: true, hasCollections: false });

        expect(show).not.toHaveBeenCalled();
    });

    it("only logs the message if it was dismissed permanently", () => {
        const { show, log } = setUp({
            isEnabled: true,
            hasCollections: true,
            showAgain: false,
        });

        expect(show).not.toHaveBeenCalled();
        expect(log).toHaveBeenCalledTimes(1);
    });

    it("shows the message when switching to the Typescript 7 server during a session", () => {
        const { show, setEnabled, fireConfigurationChange } = setUp({
            isEnabled: false,
            hasCollections: true,
        });
        expect(show).not.toHaveBeenCalled();

        setEnabled(true);
        fireConfigurationChange();

        expect(show).toHaveBeenCalledTimes(1);
    });

    it("shows the message when the first collection is added during a session", () => {
        const { show, setHasCollections, fireCollectionUpdate } = setUp({
            isEnabled: true,
            hasCollections: false,
        });
        expect(show).not.toHaveBeenCalled();

        setHasCollections(true);
        fireCollectionUpdate();

        expect(show).toHaveBeenCalledTimes(1);
    });

    it("shows the message when the Typescript 7 extension is installed during a session", () => {
        const { show, setEnabled, fireExtensionsChange } = setUp({
            isEnabled: false,
            hasCollections: true,
        });
        expect(show).not.toHaveBeenCalled();

        setEnabled(true);
        fireExtensionsChange();

        expect(show).toHaveBeenCalledTimes(1);
    });

    it("logs a warning if handling the picked option fails", async () => {
        jest.spyOn(env, "openExternal").mockRejectedValue(new Error("failed"));

        const { warn } = setUp({
            isEnabled: true,
            hasCollections: true,
            pick: "Learn more",
        });
        await flushPromises();

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain("failed");
    });

    it("does not show the message again while the Typescript 7 server stays enabled", () => {
        const { show, fireConfigurationChange } = setUp({
            isEnabled: true,
            hasCollections: true,
        });

        fireConfigurationChange();

        expect(show).toHaveBeenCalledTimes(1);
    });

    it("opens the README for 'Learn more'", async () => {
        const open = jest.spyOn(env, "openExternal");

        setUp({ isEnabled: true, hasCollections: true, pick: "Learn more" });
        await flushPromises();

        expect(open).toHaveBeenCalledTimes(1);
        expect(String(open.mock.calls[0][0])).toContain(
            "#typescript-7-language-server",
        );
    });

    it("disables the message permanently for 'Do not ask again'", async () => {
        const update = jest.fn((..._args: unknown[]): Promise<void> =>
            Promise.resolve(),
        );
        setUp({
            isEnabled: true,
            hasCollections: true,
            pick: "Do not ask again",
            update,
        });
        await flushPromises();

        expect(update).toHaveBeenCalledWith(
            "bru-as-code.informAboutTypescript7",
            false,
            expect.anything(),
        );
    });
});

function setUp({
    isEnabled,
    hasCollections,
    showAgain = true,
    pick,
    update = jest.fn((..._args: unknown[]): Promise<void> => Promise.resolve()),
}: {
    isEnabled: boolean;
    hasCollections: boolean;
    showAgain?: boolean;
    pick?: string;
    update?: (...args: unknown[]) => Promise<void>;
}) {
    let enabled = isEnabled;
    let hasCollectionsNow = hasCollections;
    jest.spyOn(
        typescript7Check,
        "isTypescript7ServerEnabled",
    ).mockImplementation(() => enabled);
    mockVsCodeSettings(
        { "bru-as-code.informAboutTypescript7": showAgain },
        update,
    );

    const show = jest
        .spyOn(window, "showInformationMessage")
        .mockResolvedValue(pick ? ({ title: pick } as never) : undefined);

    let configurationListener: (e: {
        affectsConfiguration: (key: string) => boolean;
    }) => void = () => {};
    jest.spyOn(workspace, "onDidChangeConfiguration").mockImplementation(((
        listener: typeof configurationListener,
    ) => {
        configurationListener = listener;
        return { dispose: () => {} };
    }) as never);

    let extensionsListener = () => {};
    jest.spyOn(extensions, "onDidChange").mockImplementation(((
        listener: () => void,
    ) => {
        extensionsListener = listener;
        return { dispose: () => {} };
    }) as never);

    const log = jest.fn();
    const warn = jest.fn();
    const logger = Object.assign(
        Object.create(
            jest.requireActual<typeof import("@shared")>("@shared")
                .OutputChannelLogger.prototype,
        ) as object,
        { info: log, warn },
    );
    const context = { subscriptions: [logger] } as unknown as ExtensionContext;

    let initialLoadListener = () => {};
    let updateListener = () => {};
    const provider = {
        getRegisteredCollections: () => (hasCollectionsNow ? [{}] : []),
        subscribeToInitialCacheLoad: (listener: () => void) => {
            initialLoadListener = listener;
        },
        subscribeToUpdates: (listener: () => void) => {
            updateListener = listener;
        },
    } as unknown as TypedCollectionItemProvider;

    informAboutTypescript7(context, provider);
    initialLoadListener();

    return {
        show,
        log,
        warn,
        setEnabled: (value: boolean) => (enabled = value),
        setHasCollections: (value: boolean) => (hasCollectionsNow = value),
        fireConfigurationChange: () =>
            configurationListener({ affectsConfiguration: () => true }),
        fireCollectionUpdate: () => updateListener(),
        fireExtensionsChange: () => extensionsListener(),
    };
}

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));
