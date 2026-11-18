import { QuickPickItem, window } from "vscode";

interface SequenceStepItem extends QuickPickItem {
    value: number;
}

const sequenceSteps = [1, 5, 10, 100] as const;

export function selectSequenceStep(
    folderName: string,
    configuredStep: number,
): Promise<number | undefined> {
    const quickPick = window.createQuickPick<SequenceStepItem>();
    const items = sequenceSteps.map((value) => ({
        label: value.toString(),
        description:
            value === configuredStep ? "configured default" : undefined,
        value,
    }));

    quickPick.title = `Normalize sequences in '${folderName}'`;
    quickPick.placeholder = "Choose the sequence increment";
    quickPick.items = items;
    quickPick.activeItems = [
        items.find(({ value }) => value === configuredStep) ?? items[0],
    ];

    return new Promise((resolve) => {
        let accepted = false;
        quickPick.onDidAccept(() => {
            accepted = true;
            const selectedStep =
                quickPick.activeItems[0]?.value ??
                quickPick.selectedItems[0]?.value;
            quickPick.hide();
            resolve(selectedStep);
        });
        quickPick.onDidHide(() => {
            if (!accepted) {
                resolve(undefined);
            }
            quickPick.dispose();
        });
        quickPick.show();
    });
}
