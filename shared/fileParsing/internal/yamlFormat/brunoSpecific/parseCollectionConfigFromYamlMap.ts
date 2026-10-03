import { YAMLMap } from "yaml";
import { ParsedCollectionSettingsFile, YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    WithKeyAndKeyRange,
} from "../interfaces";
import { getValidatedMapItems } from "../yamlMaps/getValidatedMapItems";
import { getTypedValueFromList } from "../scalars/getTypedValueFromList";
import { parseMapsFromSequence } from "../yamlSequences/parseMapsFromSequence";
import { parseIfPresent } from "../util/parseIfPresent";
import { getRangeForItem } from "../util/getRangeForItem";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import {
    ClientCertificateProperty,
    ClientCertificateType,
    CollectionConfigProperty,
    ProtobufProperty,
    ProtoFileProperty,
    ProtoImportPathProperty,
    ProxyAuthProperty,
    ProxyConfigProperty,
    ProxyProperty,
    ProxyProtocol,
} from "../../../external/yamlFormat/constants/collectionSettingsFileConstants";

type ParsedConfig = NonNullable<
    ParsedCollectionSettingsFile["properties"]["config"]
>;
type ParsedProtobuf = NonNullable<ParsedConfig["properties"]["protobuf"]>;
type ParsedProxy = NonNullable<ParsedConfig["properties"]["proxy"]>;

export function parseCollectionConfigFromYamlMap(
    { keyRange, value: configMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedConfig> {
    const errors: YamlParsingError[] = [];
    const { getMap, getSequence, missingProperties } = getValidatedMapItems(
        configMap,
        {
            mapValues: [
                CollectionConfigProperty.Protobuf,
                CollectionConfigProperty.Proxy,
            ],
            sequenceValues: [CollectionConfigProperty.ClientCertificates],
        },
        commonArgs,
        errors,
    );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(configMap, commonArgs),
            missingProperties,
            properties: {
                protobuf: parseIfPresent(
                    getMap(CollectionConfigProperty.Protobuf),
                    (protobufMap) => parseProtobuf(protobufMap, commonArgs),
                    errors,
                ),
                proxy: parseIfPresent(
                    getMap(CollectionConfigProperty.Proxy),
                    (proxyMap) => parseProxy(proxyMap, commonArgs),
                    errors,
                ),
                clientCertificates: parseIfPresent(
                    getSequence(CollectionConfigProperty.ClientCertificates),
                    ({ value: sequence }) =>
                        parseMapsFromSequence({
                            commonArgs,
                            sequence,
                            parseMap: (map, errors) =>
                                parseClientCertificate(map, commonArgs, errors),
                        }),
                    errors,
                ),
            },
        },
    };
}

function parseProtobuf(
    { keyRange, value: protobufMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedProtobuf> {
    const errors: YamlParsingError[] = [];
    const { getSequence, missingProperties } = getValidatedMapItems(
        protobufMap,
        { sequenceValues: Object.values(ProtobufProperty) },
        commonArgs,
        errors,
    );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(protobufMap, commonArgs),
            missingProperties,
            properties: {
                protoFiles: parseIfPresent(
                    getSequence(ProtobufProperty.ProtoFiles),
                    ({ value: sequence }) =>
                        parseMapsFromSequence({
                            commonArgs,
                            sequence,
                            parseMap: (map, errors) => {
                                const { getString, missingProperties } =
                                    getValidatedMapItems(
                                        map,
                                        {
                                            scalars: {
                                                stringValues:
                                                    Object.values(
                                                        ProtoFileProperty,
                                                    ),
                                            },
                                            mandatoryKeys: [
                                                ProtoFileProperty.Path,
                                            ],
                                        },
                                        commonArgs,
                                        errors,
                                    );
                                return {
                                    valueRange: getRangeForItem(
                                        map,
                                        commonArgs,
                                    ),
                                    missingProperties,
                                    properties: {
                                        type: stripKeyFromResult(
                                            getString(ProtoFileProperty.Type),
                                        ),
                                        path: stripKeyFromResult(
                                            getString(ProtoFileProperty.Path),
                                        ),
                                    },
                                };
                            },
                        }),
                    errors,
                ),
                importPaths: parseIfPresent(
                    getSequence(ProtobufProperty.ImportPaths),
                    ({ value: sequence }) =>
                        parseMapsFromSequence({
                            commonArgs,
                            sequence,
                            parseMap: (map, errors) => {
                                const { getString, missingProperties } =
                                    getValidatedMapItems(
                                        map,
                                        {
                                            scalars: {
                                                stringValues: Object.values(
                                                    ProtoImportPathProperty,
                                                ),
                                            },
                                            mandatoryKeys: [
                                                ProtoImportPathProperty.Path,
                                            ],
                                        },
                                        commonArgs,
                                        errors,
                                    );
                                return {
                                    valueRange: getRangeForItem(
                                        map,
                                        commonArgs,
                                    ),
                                    missingProperties,
                                    properties: {
                                        path: stripKeyFromResult(
                                            getString(
                                                ProtoImportPathProperty.Path,
                                            ),
                                        ),
                                    },
                                };
                            },
                        }),
                    errors,
                ),
            },
        },
    };
}

function parseProxy(
    { keyRange, value: proxyMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedProxy> {
    const errors: YamlParsingError[] = [];
    const { getBoolean, getMap, missingProperties } = getValidatedMapItems(
        proxyMap,
        {
            scalars: {
                booleanValues: [ProxyProperty.Inherit, ProxyProperty.Disabled],
            },
            mapValues: [ProxyProperty.Config],
        },
        commonArgs,
        errors,
    );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(proxyMap, commonArgs),
            missingProperties,
            properties: {
                inherit: stripKeyFromResult(getBoolean(ProxyProperty.Inherit)),
                disabled: stripKeyFromResult(
                    getBoolean(ProxyProperty.Disabled),
                ),
                config: parseIfPresent(
                    getMap(ProxyProperty.Config),
                    (configMap) => parseProxyConfig(configMap, commonArgs),
                    errors,
                ),
            },
        },
    };
}

function parseProxyConfig(
    { keyRange, value: configMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<NonNullable<ParsedProxy["properties"]["config"]>> {
    const errors: YamlParsingError[] = [];
    const {
        items: {
            validScalars: { withStringValue },
        },
        getString,
        getNumber,
        getMap,
        missingProperties,
    } = getValidatedMapItems(
        configMap,
        {
            scalars: {
                stringValues: [
                    ProxyConfigProperty.Protocol,
                    ProxyConfigProperty.Hostname,
                    ProxyConfigProperty.BypassProxy,
                ],
                numericValues: [ProxyConfigProperty.Port],
            },
            mapValues: [ProxyConfigProperty.Auth],
        },
        commonArgs,
        errors,
    );

    return {
        errors,
        result: {
            keyRange,
            valueRange: getRangeForItem(configMap, commonArgs),
            missingProperties,
            properties: {
                protocol: getTypedValueFromList<ProxyProtocol>(
                    {
                        allowedValues: Object.values(ProxyProtocol),
                        allStringValues: withStringValue,
                        keyName: ProxyConfigProperty.Protocol,
                    },
                    errors,
                )?.value,
                hostname: stripKeyFromResult(
                    getString(ProxyConfigProperty.Hostname),
                ),
                port: stripKeyFromResult(getNumber(ProxyConfigProperty.Port)),
                auth: parseIfPresent(
                    getMap(ProxyConfigProperty.Auth),
                    ({ keyRange, value: authMap }) => {
                        const authErrors: YamlParsingError[] = [];
                        const { getString, getBoolean, missingProperties } =
                            getValidatedMapItems(
                                authMap,
                                {
                                    scalars: {
                                        stringValues: [
                                            ProxyAuthProperty.Username,
                                            ProxyAuthProperty.Password,
                                        ],
                                        booleanValues: [
                                            ProxyAuthProperty.Disabled,
                                        ],
                                    },
                                },
                                commonArgs,
                                authErrors,
                            );
                        return {
                            errors: authErrors,
                            result: {
                                keyRange,
                                valueRange: getRangeForItem(
                                    authMap,
                                    commonArgs,
                                ),
                                missingProperties,
                                properties: {
                                    username: stripKeyFromResult(
                                        getString(ProxyAuthProperty.Username),
                                    ),
                                    password: stripKeyFromResult(
                                        getString(ProxyAuthProperty.Password),
                                    ),
                                    disabled: stripKeyFromResult(
                                        getBoolean(ProxyAuthProperty.Disabled),
                                    ),
                                },
                            },
                        };
                    },
                    errors,
                ),
                bypassProxy: stripKeyFromResult(
                    getString(ProxyConfigProperty.BypassProxy),
                ),
            },
        },
    };
}

function parseClientCertificate(
    map: YAMLMap,
    commonArgs: CommonParsingArgs,
    errors: YamlParsingError[],
): NonNullable<ParsedConfig["properties"]["clientCertificates"]>[number] {
    const {
        items: {
            validScalars: { withStringValue },
        },
        getString,
        missingProperties,
    } = getValidatedMapItems(
        map,
        {
            scalars: { stringValues: Object.values(ClientCertificateProperty) },
            mandatoryKeys: [
                ClientCertificateProperty.Domain,
                ClientCertificateProperty.Type,
            ],
        },
        commonArgs,
        errors,
    );

    return {
        valueRange: getRangeForItem(map, commonArgs),
        missingProperties,
        properties: {
            domain: stripKeyFromResult(
                getString(ClientCertificateProperty.Domain),
            ),
            type: getTypedValueFromList<ClientCertificateType>(
                {
                    allowedValues: Object.values(ClientCertificateType),
                    allStringValues: withStringValue,
                    keyName: ClientCertificateProperty.Type,
                },
                errors,
            )?.value,
            certificateFilePath: stripKeyFromResult(
                getString(ClientCertificateProperty.CertificateFilePath),
            ),
            privateKeyFilePath: stripKeyFromResult(
                getString(ClientCertificateProperty.PrivateKeyFilePath),
            ),
            pfxFilePath: stripKeyFromResult(
                getString(ClientCertificateProperty.PfxFilePath),
            ),
            passphrase: stripKeyFromResult(
                getString(ClientCertificateProperty.Passphrase),
            ),
        },
    };
}
