import { YAMLMap, YAMLSeq } from "yaml";
import { YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedWebsocketMessage,
    ParsedWebsocketMessageContent,
    WithKeyAndKeyRange,
} from "../interfaces";
import { getValidatedMapItems } from "../yamlMaps/getValidatedMapItems";
import { getYamlMapsFromSequence } from "../yamlSequences/getYamlMapsFromSequence";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import { getRangeForItem } from "../util/getRangeForItem";
import { getStringWithBlockScalarInfo } from "../util/getStringWithBlockScalarInfo";
import { parseIfPresent } from "../util/parseIfPresent";
import {
    RequestFileWebsocketMessageBodyProperty,
    RequestFileWebsocketMessageProperty,
    WebsocketMessageType,
} from "../../../external/yamlFormat/constants/requestFileConstants";

export function parseWebsocketMessagesFromSequence(
    messagesSequence: YAMLSeq,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedWebsocketMessage[]> {
    const errors: YamlParsingError[] = [];

    const { items: messageMaps, errors: errorsFromSeq } =
        getYamlMapsFromSequence({
            ...commonArgs,
            sequence: messagesSequence,
        });
    errors.push(...errorsFromSeq);

    const result = messageMaps.map((messageMap): ParsedWebsocketMessage => {
        const { getString, getBoolean, getMap } = getValidatedMapItems(
            messageMap,
            {
                scalars: {
                    stringValues: [RequestFileWebsocketMessageProperty.Title],
                    booleanValues: [
                        RequestFileWebsocketMessageProperty.Selected,
                    ],
                },
                mapValues: [RequestFileWebsocketMessageProperty.Message],
            },
            commonArgs,
            errors,
        );

        return {
            valueRange: getRangeForItem(messageMap, commonArgs),
            properties: {
                title: stripKeyFromResult(
                    getString(RequestFileWebsocketMessageProperty.Title),
                ),
                selected: stripKeyFromResult(
                    getBoolean(RequestFileWebsocketMessageProperty.Selected),
                ),
                message: parseIfPresent(
                    getMap(RequestFileWebsocketMessageProperty.Message),
                    (bodyMap) =>
                        parseWebsocketMessageContent(bodyMap, commonArgs),
                    errors,
                ),
            },
        };
    });

    return { errors, result };
}

export function parseWebsocketMessageContent(
    { keyRange, value: map }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedWebsocketMessageContent> {
    const errors: YamlParsingError[] = [];

    const { getString, getEnumValue } = getValidatedMapItems(
        map,
        {
            scalars: {
                stringValues: Object.values(
                    RequestFileWebsocketMessageBodyProperty,
                ),
                enumValues: {
                    [RequestFileWebsocketMessageBodyProperty.Type]:
                        Object.values(WebsocketMessageType),
                },
            },
        },
        commonArgs,
        errors,
    );

    const type = getEnumValue<WebsocketMessageType>(
        RequestFileWebsocketMessageBodyProperty.Type,
    );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(map, commonArgs),
            properties: {
                type,
                data: getStringWithBlockScalarInfo(
                    map,
                    RequestFileWebsocketMessageBodyProperty.Data,
                    getString(RequestFileWebsocketMessageBodyProperty.Data),
                ),
            },
        },
    };
}
