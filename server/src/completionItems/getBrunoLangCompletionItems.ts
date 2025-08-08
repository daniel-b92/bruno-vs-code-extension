import {
    ApiKeyAuthBlockKey,
    ApiKeyAuthBlockPlacementValue,
    BooleanFieldValue,
    MetaBlockKey,
    MethodBlockAuth,
    MethodBlockBody,
    MethodBlockKey,
    OAuth2BlockCredentialsPlacementValue,
    OAuth2BlockTokenPlacementValue,
    OAuth2ViaAuthorizationCodeBlockKey,
    RequestType,
    SettingsBlockKey,
} from "../../../shared";
import {
    CancellationToken,
    CompletionItem,
    Position,
    Range,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { ConsoleLogger } from "../shared/logging/consoleLogger";

export function getBrunoLangCompletionItems(
    requestData: RequestData,
    logger?: ConsoleLogger,
) {
    return getCompletionItemsForFieldsInMetaBlock(requestData, logger)
        .concat(getCompletionItemsForFieldsInMethodBlock(requestData, logger))
        .concat(getCompletionItemsForFieldsInAuthBlock(requestData, logger))
        .concat(
            getCompletionItemsForFieldsInSettingsBlock(requestData, logger),
        );
}

function getCompletionItemsForFieldsInMetaBlock(
    requestData: RequestData,
    logger?: ConsoleLogger,
) {
    const { token } = requestData;

    // ToDo: Find a way to provide completions for the value of the sequence field

    if (token.isCancellationRequested) {
        logger?.debug(
            `Cancellation requested for completion provider for bruno language.`,
        );
        return [];
    }

    return (
        getFixedCompletionsForDictionaryField(
            [
                {
                    keyName: MetaBlockKey.Type,
                    choices: Object.values(RequestType),
                },
            ],
            requestData,
            logger,
        ) ?? []
    );
}

function getCompletionItemsForFieldsInMethodBlock(
    requestData: RequestData,
    logger?: ConsoleLogger,
) {
    return (
        getFixedCompletionsForDictionaryField(
            [
                {
                    keyName: MethodBlockKey.Body,
                    choices: Object.values(MethodBlockBody),
                },
                {
                    keyName: MethodBlockKey.Auth,
                    choices: Object.values(MethodBlockAuth),
                },
            ],
            requestData,
            logger,
        ) ?? []
    );
}

function getCompletionItemsForFieldsInAuthBlock(
    requestData: RequestData,
    logger?: ConsoleLogger,
) {
    return (
        getFixedCompletionsForDictionaryField(
            [
                {
                    keyName: ApiKeyAuthBlockKey.Placement,
                    choices: Object.values(ApiKeyAuthBlockPlacementValue),
                },
                {
                    keyName:
                        OAuth2ViaAuthorizationCodeBlockKey.CredentialsPlacement,
                    choices: Object.values(
                        OAuth2BlockCredentialsPlacementValue,
                    ),
                },
                {
                    keyName: OAuth2ViaAuthorizationCodeBlockKey.Pkce,
                    choices: Object.values(BooleanFieldValue),
                },
                {
                    keyName: OAuth2ViaAuthorizationCodeBlockKey.TokenPlacement,
                    choices: Object.values(OAuth2BlockTokenPlacementValue),
                },
                {
                    keyName: OAuth2ViaAuthorizationCodeBlockKey.AutoFetchToken,
                    choices: Object.values(BooleanFieldValue),
                },
                {
                    keyName:
                        OAuth2ViaAuthorizationCodeBlockKey.AutoRefreshToken,
                    choices: Object.values(BooleanFieldValue),
                },
            ],
            requestData,
            logger,
        ) ?? []
    );
}

function getCompletionItemsForFieldsInSettingsBlock(
    requestData: RequestData,
    logger?: ConsoleLogger,
) {
    return (
        getFixedCompletionsForDictionaryField(
            [
                {
                    keyName: SettingsBlockKey.EncodeUrl,
                    choices: Object.values(BooleanFieldValue),
                },
            ],
            requestData,
            logger,
        ) ?? []
    );
}

function getFixedCompletionsForDictionaryField(
    completions: {
        keyName: string;
        choices: string[];
    }[],
    requestData: RequestData,
    logger?: ConsoleLogger,
): CompletionItem[] | undefined {
    const { document, position, token } = requestData;

    if (token.isCancellationRequested) {
        logger?.debug(
            `Cancellation requested for completion provider for bruno language.`,
        );
        return [];
    }

    const currentLine = getCurrentLine(document, position);

    return completions.reduce((prev, { choices, keyName }) => {
        if (currentLine.match(getLinePatternForDictionaryField(keyName))) {
            return prev.concat(
                choices.map((choice) => ({
                    label: choice,
                    insertText: `${currentLine.endsWith(" ") ? "" : " "}${choice}`,
                    filterText: `${keyName}: ${choice}`,
                })),
            );
        }

        return prev;
    }, [] as CompletionItem[]);
}

function getLinePatternForDictionaryField(key: string) {
    return new RegExp(`^\\s*${key}:\\s*$`);
}

function getCurrentLine(document: TextDocument, position: Position) {
    return document.getText(
        Range.create(
            Position.create(position.line, 0),
            Position.create(position.line, Number.MAX_SAFE_INTEGER),
        ),
    );
}

interface RequestData {
    document: TextDocument;
    position: Position;
    token: CancellationToken;
}
