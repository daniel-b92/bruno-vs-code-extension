import { ConfigurationTarget, MessageItem, window, workspace } from "vscode";
import { ConflictingCollectionRootFiles } from "@global_shared";
import { DialogOptionLabelEnum } from "@shared";

export async function warnAboutConflictingCollectionRoots(
    conflicts: ConflictingCollectionRootFiles[],
) {
    if (
        !workspace
            .getConfiguration()
            .get<boolean>(getSettingsKeyForShowingWarning(), false)
    ) {
        return;
    }

    const doNotAskAgainOption = DialogOptionLabelEnum.DoNotAskAgain;

    const pickedOption = await window.showWarningMessage<MessageItem>(
        `Ignoring ${conflicts.length} Bruno collection root file(s), because other collection root files exist in the same directory or its subdirectories: ${conflicts
            .map(
                ({ rootFilePath, conflictingFilePaths }) =>
                    `'${rootFilePath}' (conflicts with ${conflictingFilePaths.map((path) => `'${path}'`).join(", ")})`,
            )
            .join("; ")}`,
        { title: doNotAskAgainOption },
    );

    if (pickedOption?.title == doNotAskAgainOption) {
        await workspace
            .getConfiguration()
            .update(
                getSettingsKeyForShowingWarning(),
                false,
                ConfigurationTarget.Global,
            );
    }
}

function getSettingsKeyForShowingWarning() {
    return "bru-as-code.warnAboutConflictingCollectionRoots";
}
