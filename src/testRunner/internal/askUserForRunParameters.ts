import { window } from "vscode";
import { Collection, getDistinctTagsForCollection } from "../../shared";

enum ButtonLabels {
    Run = "Run",
    IncludeTags = "Include tags",
    ExcludeTags = "Exclude tags",
}

export async function askUserForTestrunParameters(collection: Collection) {
    const selectedTagsProvider = new SelectedTagsProvider();

    const pickedOption = await showBaseModal();

    if (pickedOption == undefined) {
        return undefined;
    }

    if (pickedOption == ButtonLabels.Run) {
        const { included: includedTags, excluded: excludedTags } =
            selectedTagsProvider.getSelectedTags();
        return { includedTags, excludedTags };
    }

    await handleOptionForTags(pickedOption, collection, selectedTagsProvider);
}

async function showBaseModal() {
    return await window.showInformationMessage(
        `Select additional config options`,
        { modal: true },
        ...Object.values(ButtonLabels),
    );
}

async function handleOptionForTags(
    selectedButton: ButtonLabels.IncludeTags | ButtonLabels.ExcludeTags,
    collection: Collection,
    selectedTagsProvider: SelectedTagsProvider,
) {
    const { included: includedTags, excluded: excludedTags } =
        selectedTagsProvider.getSelectedTags();

    const tagsToChoose = getDistinctTagsForCollection(collection).filter(
        (tag) =>
            selectedButton == ButtonLabels.IncludeTags
                ? !excludedTags.includes(tag)
                : !includedTags.includes(tag),
    );

    const selectedTags = await window.showQuickPick(tagsToChoose, {
        title: `Tags to ${selectedButton == ButtonLabels.IncludeTags ? "include" : "exclude"}`,
        canPickMany: true,
    });

    if (!selectedTags) {
        return;
    }

    if (selectedButton == ButtonLabels.IncludeTags) {
        selectedTagsProvider.addIncludedTags(selectedTags);
        return;
    }

    selectedTagsProvider.addExcludedTags(selectedTags);
    return;
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

    public addIncludedTags(newTags: string[]) {
        SelectedTagsProvider.validateTagsAreNew(newTags, this.includedTags);
        this.includedTags.push(...newTags);
    }

    public addExcludedTags(newTags: string[]) {
        SelectedTagsProvider.validateTagsAreNew(newTags, this.excludedTags);
        this.excludedTags.push(...newTags);
    }

    private static validateTagsAreNew(
        newTags: string[],
        existingTags: string[],
    ) {
        const alreadyExistingTags = newTags.filter((tag) =>
            existingTags.includes(tag),
        );

        if (alreadyExistingTags.length > 0) {
            throw new Error(
                `Some tags were already stored before: ${JSON.stringify(alreadyExistingTags)}`,
            );
        }
    }
}
