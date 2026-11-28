import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { ConfigurationTarget, window } from "vscode";
import { mockVsCodeSettings } from "../../../../_testingUtils";
import { offerSavingSequenceStep } from "./offerSavingSequenceStep";

describe("offerSavingSequenceStep", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("asks whether to use the chosen step in the workspace", async () => {
        mockVsCodeSettings({});
        const show = mockMessage();

        await offerSavingSequenceStep(10);

        expect(show.mock.calls).toEqual([
            [
                "Use 10 as the sequence step in this workspace?",
                { title: "Save in workspace settings" },
                { title: "Do not ask again" },
            ],
        ]);
    });

    it.each<[string, number, Record<string, unknown>]>([
        ["is the configured one", 10, { "bru-as-code.sequenceStep": 10 }],
        ["is the default and none is configured", 1, {}],
        [
            "differs, but the offer is disabled",
            10,
            { "bru-as-code.offerSavingSequenceStep": false },
        ],
    ])("shows nothing if the step %s", async (_, step, settings) => {
        mockVsCodeSettings(settings);
        const show = mockMessage();

        await offerSavingSequenceStep(step);

        expect(show).not.toHaveBeenCalled();
    });

    it.each([
        [
            "Save in workspace settings",
            "bru-as-code.sequenceStep",
            10,
            ConfigurationTarget.Workspace,
        ],
        [
            "Do not ask again",
            "bru-as-code.offerSavingSequenceStep",
            false,
            ConfigurationTarget.Global,
        ],
    ])("for '%s', sets '%s' to %p", async (pick, key, value, target) => {
        const update = jest.fn(() => Promise.resolve());
        mockVsCodeSettings({}, update);
        mockMessage(pick);

        await offerSavingSequenceStep(10);

        expect(update.mock.calls).toEqual([[key, value, target]]);
    });

    it("does not change any setting if the message is closed", async () => {
        const update = jest.fn(() => Promise.resolve());
        mockVsCodeSettings({}, update);
        mockMessage();

        await offerSavingSequenceStep(10);

        expect(update).not.toHaveBeenCalled();
    });

    it("logs a warning if saving the step fails", async () => {
        mockVsCodeSettings({}, () => Promise.reject(new Error("failed")));
        mockMessage("Save in workspace settings");
        const warn = jest.fn();

        await offerSavingSequenceStep(10, { warn } as never);

        expect(warn.mock.calls).toEqual([[expect.stringContaining("failed")]]);
    });
});

function mockMessage(pick?: string) {
    return jest
        .spyOn(window, "showInformationMessage")
        .mockResolvedValue(pick ? ({ title: pick } as never) : undefined);
}
