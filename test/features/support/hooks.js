const fs = require('fs');
const createTestCafe = require('testcafe');
const testControllerHolder = require('../support/testControllerHolder');
const {AfterAll, setDefaultTimeout, Before, After, Status} = require('cucumber');
const errorHandling = require('../support/errorHandling');

let isTestCafeError = false;
let attachScreenshotToReport = null;
let cafeRunner = null;
let runCount = 0;


function createTestFile() {
    fs.writeFileSync('test.js',
        'import errorHandling from "./features/support/errorHandling.js";\n' +
        'import testControllerHolder from "./features/support/testControllerHolder.js";\n\n' +
        'fixture("fixture")\n' +
        `.httpAuth({username: "${process.env.TESTCAFE_HTTP_AUTU_USERNAME}", password: "${process.env.TESTCAFE_HTTP_AUTU_PASSWORD}"})\n` +
        'test\n' +
        '("test", testControllerHolder.capture)')
}

// Refer: https://devexpress.github.io/testcafe/documentation/using-testcafe/programming-interface/runner.html#run
function runTest(iteration) {
    createTestCafe('localhost', 1338 + iteration, 1339 + iteration)
        .then(function(tc) {
            cafeRunner = tc;
            const runner = tc.createRunner();
            return runner
                .src('./test.js')
                .screenshots('reports/screenshots/', true)
                .browsers(process.env.TESTCAFE_BROWSER)
                .concurrency(parseInt(process.env.TESTCAFE_CONCURRENCY))
                .run({
                    skipJsErrors: process.env.TESTCAFE_SKIP_JS_ERRORS,
                    skipUncaughtErrors: process.env.TESTCAFE_SKIP_UNCAUGHT_ERRORS,
                    selectorTimeout: process.env.TESTCAFE_SELECTOR_TIMEOUT,
                    assertionTimeout: process.env.TESTCAFE_ASSERTION_TIMEOUT,
                    pageLoadTimeout: process.env.TESTCAFE_PAGE_LOAD_TIMEOUT,
                    speed: parseInt(process.env.TESTCAFE_RUN_SPEED),
                    stopOnFirstFail: process.env.TESTCAFE_STOP_ON_1ST_FAIL
                })
                .catch(function(error) {
                    console.error(error);
                });
        })
        .then(function(report) {
        });
}

setDefaultTimeout(process.env.TESTCAFE_GENERIC_TIMEOUT);

Before(function() {
    runTest(runCount, this.setBrowser());
    createTestFile();
    runCount += 2;
    return this.waitForTestController.then(function(testController) {
        return testController.maximizeWindow();
    });
});

// Refer: https://github.com/cucumber/cucumber-js/blob/master/docs/support_files/hooks.md
Before({tags: process.env.TESTCAFE_IGNORE_TAGS}, function () {
    return 'skipped';
  });

After(function() {
    fs.unlinkSync('test.js');
    testControllerHolder.free();
});

After(async function(testCase) {
    const world = this;
    if (testCase.result.status === Status.FAILED) {
        isTestCafeError = true;
        attachScreenshotToReport = world.attachScreenshotToReport;
        errorHandling.addErrorToController();
        await errorHandling.ifErrorTakeScreenshot(testController)
    }

});

AfterAll(function() {

    let intervalId = null;

    function waitForTestCafe() {
        intervalId = setInterval(checkLastResponse, 500);
    }

    function checkLastResponse() {
        if (testController.testRun.lastDriverStatusResponse === 'test-done-confirmation') {
            cafeRunner.close();
            process.exit();
            clearInterval(intervalId);
        }
    }

    waitForTestCafe();

});

const getIsTestCafeError = function() {
    return isTestCafeError;
};

const getAttachScreenshotToReport = function(path) {
    return attachScreenshotToReport(path);
};

exports.getIsTestCafeError = getIsTestCafeError;
exports.getAttachScreenshotToReport = getAttachScreenshotToReport;
