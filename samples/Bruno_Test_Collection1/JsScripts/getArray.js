function getArray() {
    bru.setEnvVar("test", `33-${bru.getEnvVar("example")}`);
    return [12, 44, 55];
}

// eslint-disable-next-line no-undef
module.exports = getArray;
