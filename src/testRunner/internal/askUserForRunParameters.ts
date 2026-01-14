import { Disposable, EventEmitter, QuickPickItem, window } from "vscode";
import { Collection, getDistinctTagsForCollection } from "../../shared";

enum ButtonLabel {
    Run = "Run",
    IncludeTags = "Include tags",
    ExcludeTags = "Exclude tags",
}

export async function askUserForTestrunParameters(collection: Collection) {
    const selectedTagsProvider = new SelectedTagsProvider();
    const handleBaseModalNotifier = new EventEmitter<void>();
    const handleTagsDialogNotifier = new EventEmitter<
        ButtonLabel.IncludeTags | ButtonLabel.ExcludeTags
    >();
    const toDispose: Disposable[] = [];

    const userInputPromise = new Promise<
        | {
              includedTags: string[];
              excludedTags: string[];
          }
        | undefined
    >((resolve) => {
        toDispose.push(
            handleBaseModalNotifier.event(() => {
                handleBaseModalInteractions(
                    selectedTagsProvider,
                    handleTagsDialogNotifier,
                ).then(({ shouldContinue, value }) => {
                    if (!shouldContinue) {
                        resolve(value);
                    }
                });
            }),
            handleTagsDialogNotifier.event((selectedButton) => {
                handleDialogForTags(
                    selectedButton,
                    collection,
                    selectedTagsProvider,
                    handleBaseModalNotifier,
                );
            }),
        );
    });
    handleBaseModalNotifier.fire();

    const userInput = await userInputPromise;
    toDispose.forEach((d) => d.dispose());
    return userInput;
}

async function handleBaseModalInteractions(
    selectedTagsProvider: SelectedTagsProvider,
    tagsDialogNotifier: EventEmitter<
        ButtonLabel.IncludeTags | ButtonLabel.ExcludeTags
    >,
): Promise<{
    shouldContinue: boolean;
    value?: { includedTags: string[]; excludedTags: string[] };
}> {
    const { included: includedTags, excluded: excludedTags } =
        selectedTagsProvider.getSelectedTags();

    const pickedOption = await window.showInformationMessage(
        `Do you want to add additional config options?`,
        {
            modal: true,
            detail: `Currently ${includedTags.length} included tags, ${excludedTags.length} excluded tags`,
        },
        ...Object.values(ButtonLabel),
    );

    if (pickedOption == undefined) {
        return { shouldContinue: false };
    }

    if (pickedOption == ButtonLabel.Run) {
        const { included: includedTags, excluded: excludedTags } =
            selectedTagsProvider.getSelectedTags();
        return { shouldContinue: false, value: { includedTags, excludedTags } };
    }

    tagsDialogNotifier.fire(pickedOption);
    return { shouldContinue: true };
}

async function handleDialogForTags(
    selectedButton: ButtonLabel.IncludeTags | ButtonLabel.ExcludeTags,
    collection: Collection,
    selectedTagsProvider: SelectedTagsProvider,
    baseModalNotifier: EventEmitter<void>,
) {
    const { included: includedTags, excluded: excludedTags } =
        selectedTagsProvider.getSelectedTags();

    const items: QuickPickItem[] = getDistinctTagsForCollection(collection)
        .filter((tag) =>
            selectedButton == ButtonLabel.IncludeTags
                ? !excludedTags.includes(tag)
                : !includedTags.includes(tag),
        )
        .map((tag) => ({
            label: tag,
            picked:
                selectedButton == ButtonLabel.IncludeTags
                    ? includedTags.includes(tag)
                    : excludedTags.includes(tag),
        }));

    const selectedItems = await window.showQuickPick(items, {
        canPickMany: true,
        ignoreFocusOut: true,
        title: `Tags to ${selectedButton == ButtonLabel.IncludeTags ? "include" : "exclude"}`,
    });

    if (!selectedItems) {
        return;
    }

    const selectedTags = selectedItems.map(({ label }) => label);

    switch (selectedButton) {
        case ButtonLabel.IncludeTags:
            selectedTagsProvider.setIncludedTags(selectedTags);
            break;
        case ButtonLabel.ExcludeTags:
            selectedTagsProvider.setExcludedTags(selectedTags);
            break;
    }

    baseModalNotifier.fire();
}

class SelectedTagsProvider {
    constructor() {}

    private includedTags: string[] = [];
    private excludedTags: string[] = [];

    public getSelectedTags() {
        return {
            included: this.includedTags.slice(),
            excluded: this.excludedTags.slice(),
        };
    }

    public setIncludedTags(newTags: string[]) {
        if (this.includedTags.length > 0) {
            this.includedTags.splice(0);
        }
        this.includedTags.push(...newTags);
    }

    public setExcludedTags(newTags: string[]) {
        if (this.excludedTags.length > 0) {
            this.excludedTags.splice(0);
        }
        this.excludedTags.push(...newTags);
    }
}
