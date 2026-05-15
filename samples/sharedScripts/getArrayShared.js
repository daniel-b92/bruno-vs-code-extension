function getArrayShared() {
    bru.setEnvVar("test", `33-${bru.getEnvVar("example")}`);
    expect(12).to.not.be.undefined;
    return [12, 44, 55];
}

// eslint-disable-next-line no-undef
module.exports = getArrayShared;
