import {
    commands,
    CompletionItem,
    CompletionList,
    languages,
    Range as VsCodeRange,
    TextEdit,
    Uri,
    workspace,
} from "vscode";
import {
    ApiKeyAuthBlockKey,
    ApiKeyAuthBlockPlacementValue,
    BooleanFieldValue,
    CollectionItemProvider,
    getMaxSequenceForRequests,
    mapRange,
    MetaBlockKey,
    MethodBlockAuth,
    MethodBlockBody,
    MethodBlockKey,
    OAuth2BlockCredentialsPlacementValue,
    OAuth2BlockTokenPlacementValue,
    OAuth2ViaAuthorizationCodeBlockKey,
    parseBruFile,
    RequestFileBlockName,
    RequestType,
    TextDocumentHelper,
} from "../../../shared";
import { dirname } from "path";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { getTemporaryJsFileName } from "../shared/codeBlocksUtils/getTemporaryJsFileName";
import { getCodeBlocks } from "../shared/codeBlocksUtils/getCodeBlocks";
import { isTempJsFileInSync } from "../shared/codeBlocksUtils/isTempJsFileInSync";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { mapToRangeWithinBruFile } from "../shared/codeBlocksUtils/mapToRangeWithinBruFile";

export function provideBrunoLangCompletionItems(
    collectionItemProvider: CollectionItemProvider
) {
    getCompletionItemsForFieldsInMetaBlock();
    getCompletionItemsForFieldsInMethodBlock();
    getCompletionItemsForFieldsInAuthBlock();
    getCompletionsForTextBlocks(collectionItemProvider);
}

function getCompletionsForTextBlocks(
    collectionItemProvider: CollectionItemProvider
) {
    languages.registerCompletionItemProvider(
        getRequestFileDocumentSelector(),
        {
            async provideCompletionItems(document, position) {
                const collection =
                    collectionItemProvider.getAncestorCollectionForPath(
                        document.fileName
                    );

                if (!collection) {
                    return [];
                }

                const blocksToCheck = getCodeBlocks(
                    parseBruFile(new TextDocumentHelper(document.getText()))
                        .blocks
                );

                const blockInBruFile = blocksToCheck.find(({ contentRange }) =>
                    mapRange(contentRange).contains(position)
                );

                if (blockInBruFile) {
                    const virtualJsFileUri = Uri.file(
                        getTemporaryJsFileName(
                            collection.getRootDirectory(),
                            document.fileName
                        )
                    );

                    const virtualJsDoc = await workspace.openTextDocument(
                        virtualJsFileUri
                    );

                    // Sometimes it takes a short while until VS Code notices that the Javascript file has been modified externally
                    if (
                        !isTempJsFileInSync(
                            virtualJsDoc.getText(),
                            blocksToCheck
                        )
                    ) {
                        await new Promise<void>((resolve) => {
                            workspace.onDidChangeTextDocument((e) => {
                                if (
                                    e.document.uri.toString() ==
                                        virtualJsFileUri.toString() &&
                                    e.contentChanges.length > 0 &&
                                    isTempJsFileInSync(
                                        virtualJsDoc.getText(),
                                        blocksToCheck
                                    )
                                ) {
                                    resolve();
                                }
                            });
                        });
                    }

                    const resultFromJsFile =
                        await commands.executeCommand<CompletionList>(
                            "vscode.executeCompletionItemProvider",
                            virtualJsDoc.uri,
                            getPositionWithinTempJsFile(
                                virtualJsDoc.getText(),
                                blockInBruFile.name as RequestFileBlockName,
                                position.translate(
                                    -blockInBruFile.contentRange.start.line
                                )
                            )
                        );

                    return new CompletionList<CompletionItem>(
                        resultFromJsFile.items.map((item) => ({
                            ...item,
                            range: item.range
                                ? item.range instanceof VsCodeRange
                                    ? (mapToRangeWithinBruFile(
                                          blocksToCheck,
                                          virtualJsDoc.getText(),
                                          item.range
                                      ) as VsCodeRange)
                                    : {
                                          inserting: mapToRangeWithinBruFile(
                                              blocksToCheck,
                                              virtualJsDoc.getText(),
                                              item.range.inserting
                                          ) as VsCodeRange,
                                          replacing: mapToRangeWithinBruFile(
                                              blocksToCheck,
                                              virtualJsDoc.getText(),
                                              item.range.replacing
                                          ) as VsCodeRange,
                                      }
                                : undefined,
                            textEdit: item.textEdit
                                ? new TextEdit(
                                      mapToRangeWithinBruFile(
                                          blocksToCheck,
                                          virtualJsDoc.getText(),
                                          item.textEdit.range
                                      ) as VsCodeRange,
                                      item.textEdit.newText
                                  )
                                : undefined,
                        })),
                        resultFromJsFile.isIncomplete
                    );
                } else {
                    return undefined;
                }
            },
        },
        ".",
        " ",
        "(",
        "/"
    );
}

function getCompletionItemsForFieldsInMetaBlock() {
    registerFixedCompletionItems([
        {
            linePattern: getLinePatternForDictionaryField(MetaBlockKey.Type),
            choices: Object.values(RequestType),
        },
    ]);

    languages.registerCompletionItemProvider(
        getRequestFileDocumentSelector(),
        {
            provideCompletionItems(document, position) {
                const currentText = document.lineAt(position.line).text;
                const sequencePattern = new RegExp(
                    `^\\s*${MetaBlockKey.Sequence}:\\s*$`,
                    "m"
                );

                if (currentText.match(sequencePattern)) {
                    return {
                        items: [
                            new CompletionItem(
                                `${currentText.endsWith(" ") ? "" : " "}${
                                    getMaxSequenceForRequests(
                                        dirname(document.uri.fsPath)
                                    ) + 1
                                }`
                            ),
                        ],
                    };
                } else {
                    return undefined;
                }
            },
        },
        ...getTriggerChars()
    );
}

function getCompletionItemsForFieldsInMethodBlock() {
    registerFixedCompletionItems([
        {
            linePattern: getLinePatternForDictionaryField(MethodBlockKey.Body),
            choices: Object.values(MethodBlockBody),
        },
        {
            linePattern: getLinePatternForDictionaryField(MethodBlockKey.Auth),
            choices: Object.values(MethodBlockAuth),
        },
    ]);
}

function getCompletionItemsForFieldsInAuthBlock() {
    registerFixedCompletionItems([
        {
            linePattern: getLinePatternForDictionaryField(
                ApiKeyAuthBlockKey.Placement
            ),
            choices: Object.values(ApiKeyAuthBlockPlacementValue),
        },
        {
            linePattern: getLinePatternForDictionaryField(
                OAuth2ViaAuthorizationCodeBlockKey.CredentialsPlacement
            ),
            choices: Object.values(OAuth2BlockCredentialsPlacementValue),
        },
        {
            linePattern: getLinePatternForDictionaryField(
                OAuth2ViaAuthorizationCodeBlockKey.Pkce
            ),
            choices: Object.values(BooleanFieldValue),
        },
        {
            linePattern: getLinePatternForDictionaryField(
                OAuth2ViaAuthorizationCodeBlockKey.TokenPlacement
            ),
            choices: Object.values(OAuth2BlockTokenPlacementValue),
        },
        {
            linePattern: getLinePatternForDictionaryField(
                OAuth2ViaAuthorizationCodeBlockKey.AutoFetchToken
            ),
            choices: Object.values(BooleanFieldValue),
        },
        {
            linePattern: getLinePatternForDictionaryField(
                OAuth2ViaAuthorizationCodeBlockKey.AutoRefreshToken
            ),
            choices: Object.values(BooleanFieldValue),
        },
    ]);
}

function registerFixedCompletionItems(
    params: {
        linePattern: RegExp;
        choices: string[];
    }[]
) {
    languages.registerCompletionItemProvider(
        getRequestFileDocumentSelector(),
        {
            provideCompletionItems(document, position) {
                const currentText = document.lineAt(position.line).text;

                const items: CompletionItem[] = [];

                for (const { linePattern, choices } of params) {
                    if (currentText.match(linePattern)) {
                        items.push(
                            ...choices.map(
                                (choice) =>
                                    new CompletionItem(
                                        `${
                                            currentText.endsWith(" ") ? "" : " "
                                        }${choice}`
                                    )
                            )
                        );
                    }
                }

                return items;
            },
        },
        ...getTriggerChars()
    );
}

function getTriggerChars() {
    return [":", " "];
}

function getLinePatternForDictionaryField(key: string) {
    return new RegExp(`^\\s*${key}:\\s*$`);
}
