import {
    describe,
    it,
    expect,
    jest,
    beforeEach,
    afterEach,
} from "@jest/globals";
import { env, ExtensionContext, window } from "vscode";
import {
    createExtensionContextStub,
    mockVsCodeSettings,
} from "../../../../_testingUtils";
import {
    initializeSequenceGapsHint,
    showSequenceGapsHintIfNeeded,
} from "./sequenceGapsHint";

describe("sequenceGapsHint", () => {
    beforeEach(() => {
        initializeSequenceGapsHint(createExtensionContextStub());
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("shows the hint with the number of shifted items and both options", async () => {
        const show = mockHint();

        await showHintFor(7);

        expect(show).toHaveBeenCalledTimes(1);
        expect(show.mock.calls[0]).toEqual([
            "Inserting this item also changed the sequence of 7 other items. With gaps between sequences, most inserts only change one file.",
            { title: "Learn more" },
            { title: "Do not show again" },
        ]);
    });

    it.each([
        [2, 0],
        [3, 1],
    ])(
        "for %i shifted items, shows the hint %i times",
        async (count, times) => {
            const show = mockHint();

            await showHintFor(count);

            expect(show).toHaveBeenCalledTimes(times);
        },
    );

    it.each<[string, Record<string, unknown>]>([
        ["the sequence step is not 1", { "bru-as-code.sequenceStep": 10 }],
        [
            "automatic renumbering is enabled",
            { "bru-as-code.renumberSequencesAutomatically": true },
        ],
    ])("shows nothing if %s", async (_, settings) => {
        mockVsCodeSettings(settings);
        const show = mockHint();

        await showHintFor(3);

        expect(show).not.toHaveBeenCalled();
    });

    it("is not shown again, also after a restart or in another workspace", async () => {
        const globalState = new Map<string, unknown>();
        initializeSequenceGapsHint(createExtensionContextStub(globalState));
        const show = mockHint();

        await showHintFor(3);
        await showHintFor(3);
        initializeSequenceGapsHint(createExtensionContextStub(globalState));
        await showHintFor(3);

        expect(show).toHaveBeenCalledTimes(1);
    });

    it("is not shown again while it is still open", async () => {
        const show = mockHint().mockReturnValue(new Promise<never>(() => {}));

        showSequenceGapsHintIfNeeded(3);
        showSequenceGapsHintIfNeeded(3);

        await flushPromises();

        expect(show).toHaveBeenCalledTimes(1);
    });

    it("opens the README section for 'Learn more'", async () => {
        mockHint("Learn more");
        const open = jest.spyOn(env, "openExternal");

        await showHintFor(3);

        expect(open).toHaveBeenCalledTimes(1);
        expect(String(open.mock.calls[0][0])).toBe(
            "https://github.com/daniel-b92/bruno-vs-code-extension#review-friendly-diffs",
        );
    });

    it.each([undefined, "Do not show again"])(
        "does not open anything if %s is picked",
        async (pick) => {
            mockHint(pick);
            const open = jest.spyOn(env, "openExternal");

            await showHintFor(3);

            expect(open).not.toHaveBeenCalled();
        },
    );

    it("logs a warning if handling the picked option fails", async () => {
        mockHint("Learn more");
        jest.spyOn(env, "openExternal").mockRejectedValue(new Error("failed"));
        const warn = jest.fn();
        initializeSequenceGapsHint(createContextWithLogger(warn));

        await showHintFor(3);

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain("failed");
    });
});

function mockHint(pick?: string) {
    return jest
        .spyOn(window, "showInformationMessage")
        .mockResolvedValue(pick ? ({ title: pick } as never) : undefined);
}

async function showHintFor(shiftedItemsCount: number) {
    showSequenceGapsHintIfNeeded(shiftedItemsCount);
    await flushPromises();
}

function createContextWithLogger(warn: (message: unknown) => void) {
    const logger = Object.assign(
        Object.create(
            jest.requireActual<typeof import("@shared")>("@shared")
                .OutputChannelLogger.prototype,
        ) as object,
        { warn },
    );
    const context: ExtensionContext = createExtensionContextStub();
    context.subscriptions.push(logger as never);

    return context;
}

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));
