module.exports = {
    transform: { "\\.ts$": ['ts-jest'] },
    setupFilesAfterEnv: ['./jest.setup.js', './jest.setup.redis-mock.js']
};