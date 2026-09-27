import { describe, it, expect } from "@jest/globals";
import { BrunoFileType } from "@global_shared";
import { createCollectionWithEnvironments } from "@global_shared/_testingUtils";
import { getDeleteConfirmationMessage } from "./getDeleteConfirmationMessage";

describe("getDeleteConfirmationMessage", () => {
    it("returns a plain confirmation message for a non-environment item", () => {
        const collection = createCollectionWithEnvironments([]);

        const message = getDeleteConfirmationMessage(
            "request.bru",
            "/collection/request.bru",
            BrunoFileType.RequestFile,
            collection,
        );

        expect(message).toBe("Delete 'request.bru'?");
    });

    it("returns a plain confirmation message for an environment with no dependents", () => {
        const collection = createCollectionWithEnvironments([{ name: "Base" }]);

        const message = getDeleteConfirmationMessage(
            "Base.bru",
            "/collection/environments/Base.bru",
            BrunoFileType.EnvironmentFile,
            collection,
        );

        expect(message).toBe("Delete 'Base.bru'?");
    });

    it("warns about dependent environments when deleting an environment other environments extend", () => {
        const collection = createCollectionWithEnvironments([
            { name: "Base" },
            { name: "Staging", extends: "Base" },
            { name: "Dev", extends: "Base" },
        ]);

        const message = getDeleteConfirmationMessage(
            "Base.bru",
            "/collection/environments/Base.bru",
            BrunoFileType.EnvironmentFile,
            collection,
        );

        expect(message).toBe(
            "Delete 'Base.bru'? The environment(s) 'Staging', 'Dev' extend it and will lose access to its variables.",
        );
    });
});
