import { YAMLMap, YAMLSeq } from "yaml";
import { YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedWebsocketMessage,
    WithKeyAndKeyRange,
} from "../interfaces";
import { getValidatedMapItems } from "../yamlMaps/getValidatedMapItems";
import { getYamlMapsFromSequence } from "../yamlSequences/getYamlMapsFromSequence";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import { getRangeForItem } from "../util/getRangeForItem";
import { getStringWithBlockScalarInfo } from "../util/getStringWithBlockScalarInfo";
import { getTypedValueFromList } from "../scalars/getTypedValueFromList";
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
        const { getString, getBoolean, getMap, missingProperties } =
            getValidatedMapItems(
                messageMap,
                {
                    scalars: {
                        stringValues: [
                            RequestFileWebsocketMessageProperty.Title,
                        ],
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
            missingProperties,
            properties: {
                title: stripKeyFromResult(
                    getString(RequestFileWebsocketMessageProperty.Title),
                ),
                selected: stripKeyFromResult(
                    getBoolean(RequestFileWebsocketMessageProperty.Selected),
                ),
                message: parseIfPresent(
                    getMap(RequestFileWebsocketMessageProperty.Message),
                    (bodyMap) => parseMessageBody(bodyMap, commonArgs),
                    errors,
                ),
            },
        };
    });

    return { errors, result };
}

function parseMessageBody(
    { keyRange, value: map }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<
    NonNullable<ParsedWebsocketMessage["properties"]["message"]>
> {
    const errors: YamlParsingError[] = [];

    const {
        getString,
        items: {
            validScalars: { withStringValue: validStrings },
        },
        missingProperties,
    } = getValidatedMapItems(
        map,
        {
            scalars: {
                stringValues: Object.values(
                    RequestFileWebsocketMessageBodyProperty,
                ),
            },
        },
        commonArgs,
        errors,
    );

    const type = getTypedValueFromList<WebsocketMessageType>(
        {
            allStringValues: validStrings,
            keyName: RequestFileWebsocketMessageBodyProperty.Type,
            allowedValues: Object.values(WebsocketMessageType),
        },
        errors,
    )?.value;

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(map, commonArgs),
            missingProperties,
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
