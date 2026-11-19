import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { mockVsCodeSettings } from "../../_testingUtils";
import {
    getSequenceStepFromSettings,
    shouldRenumberSequencesAutomatically,
} from "./sequenceSettings";

describe("sequenceSettings", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("getSequenceStepFromSettings", () => {
        it("returns the configured step", () => {
            mockVsCodeSettings({ "bru-as-code.sequenceStep": 10 });

            expect(getSequenceStepFromSettings()).toBe(10);
        });

        it.each([undefined, 0, -5, 2.5, "10", null, "\n"])(
            "falls back to 1 for the invalid value %p",
            (value) => {
                mockVsCodeSettings({ "bru-as-code.sequenceStep": value });

                expect(getSequenceStepFromSettings()).toBe(1);
            },
        );
    });

    describe("shouldRenumberSequencesAutomatically", () => {
        it("is disabled by default", () => {
            mockVsCodeSettings({});

            expect(shouldRenumberSequencesAutomatically()).toBe(false);
        });

        it("is enabled if the setting is `true`", () => {
            mockVsCodeSettings({
                "bru-as-code.renumberSequencesAutomatically": true,
            });

            expect(shouldRenumberSequencesAutomatically()).toBe(true);
        });

        it("is disabled for values that are not a boolean", () => {
            mockVsCodeSettings({
                "bru-as-code.renumberSequencesAutomatically": "true",
            });

            expect(shouldRenumberSequencesAutomatically()).toBe(false);
        });
    });
});
