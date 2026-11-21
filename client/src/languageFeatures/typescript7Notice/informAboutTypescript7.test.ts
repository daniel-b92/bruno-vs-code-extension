import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { env, ExtensionContext, window, workspace } from "vscode";
import { TypedCollectionItemProvider } from "@shared";
import { informAboutTypescript7 } from "./informAboutTypescript7";
import * as typescript7Check from "./isTypescript7ServerEnabled";

describe("informAboutTypescript7", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("shows the message and logs it once collections are loaded and the Typescript 7 server is used", () => {
        const { show } = setUp({ isEnabled: true, hasCollections: true });

        expect(show).toHaveBeenCalledTimes(1);
        expect(show.mock.calls[0][0]).toContain("Typescript 7");
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

    it("disables the message permanently for 'Don't show again'", async () => {
        const update = jest.fn((..._args: unknown[]): Promise<void> =>
            Promise.resolve(),
        );
        setUp({
            isEnabled: true,
            hasCollections: true,
            pick: "Don't show again",
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
    jest.spyOn(
        typescript7Check,
        "isTypescript7ServerEnabled",
    ).mockImplementation(() => enabled);
    jest.spyOn(workspace, "getConfiguration").mockReturnValue({
        get: () => showAgain,
        update,
    } as never);

    const show = jest
        .spyOn(window, "showInformationMessage")
        .mockResolvedValue(pick ? ({ title: pick } as never) : undefined);

    let configurationListener: (e: {
        affectsConfiguration: (key: string) => boolean;
    }) => void = () => {};
    (workspace as unknown as Record<string, unknown>).onDidChangeConfiguration =
        (listener: typeof configurationListener) => {
            configurationListener = listener;
            return { dispose: () => {} };
        };

    const log = jest.fn();
    const logger = Object.assign(
        Object.create(
            jest.requireActual<typeof import("@shared")>("@shared")
                .OutputChannelLogger.prototype,
        ) as object,
        { info: log },
    );
    const context = { subscriptions: [logger] } as unknown as ExtensionContext;

    let initialLoadListener = () => {};
    const provider = {
        getRegisteredCollections: () => (hasCollections ? [{}] : []),
        subscribeToInitialCacheLoad: (listener: () => void) => {
            initialLoadListener = listener;
        },
    } as unknown as TypedCollectionItemProvider;

    informAboutTypescript7(context, provider);
    initialLoadListener();

    return {
        show,
        log,
        setEnabled: (value: boolean) => (enabled = value),
        fireConfigurationChange: () =>
            configurationListener({ affectsConfiguration: () => true }),
    };
}

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));
