
const request = require("supertest");
const assert = require("chai").assert;
// const expect = require("chai").expect;


describe("express with slowapp no insecure", function () {
    var server;
    var slow_server;
    var env;
    before(function () {
        env = process.env;
        let app = require("./app");
        app.setup({UPSTREAM: "http://localhost:9003", LOG_LEVEL: (process.env.NODE_ENV === "test" ? "warn": "debug")});
        server = app.start();
        let slowapp = require("../../async-slowapp/src/app");
        slowapp.setup({BASE_URI: "http://localhost:9003", LOG_LEVEL: (process.env.NODE_ENV === "test" ? "warn": "debug")});
        slow_server = slowapp.start({PORT: 9003})
    });

    beforeEach(function () {

    });
    afterEach(function () {

    });
    after(function () {
        process.env = env;
        slow_server.close();
        server.close();

    });

    it("responds to /_status", (done) => {
        request(server)
            .get("/_status")
            .expect(200, {
                status: "pass",
                ping: "pong",
                service: "sync-wrap",
                _version: {}
            })
            .expect("Content-Type", /json/, done);
    });

    it("responds to /_ping upstream", (done) => {
        request(server)
            .get("/_ping")
            .expect(200, done);
    });
});


describe("express with slowap", function () {
    var server;
    var slow_server;
    var env;
    before(function () {
        env = process.env;
        let app = require("./app");
        app.setup({UPSTREAM: "http://localhost:9003",  LOG_LEVEL: (process.env.NODE_ENV === "test" ? "warn": "debug")});
        server = app.start();

        let slowapp = require("../../async-slowapp/src/app");
        slowapp.setup({BASE_URI: "http://localhost:9003", LOG_LEVEL: (process.env.NODE_ENV === "test" ? "warn": "debug")});
        slow_server = slowapp.start({PORT: 9003})
    });

    beforeEach(function () {

    });
    afterEach(function () {

    });
    after(function () {
        process.env = env;
        slow_server.close();
        server.close();
    });

    it("responds to /_status", (done) => {
        request(server)
            .get("/_status")
            .expect(200, {
                status: "pass",
                ping: "pong",
                service: "sync-wrap",
                _version: {}
            })
            .expect("Content-Type", /json/, done);
    });

    it("responds to /sub/_status", (done) => {
        request(server)
            .get("/sub/_status")
            .expect(200, {ping: "pong", service: "async-slowapp", _version: {}})
            .expect("Content-Type", /json/, done);
    });

    it("responds to /sub/_ping upstream", (done) => {
        request(server)
            .get("/sub/_ping")
            .expect(200, {ping: "pong", service: "async-slowapp", _version: {}})
            .expect("Content-Type", /json/, done);
    });

    it("it times out if x-sync-wait shorter than initial response", (done) => {
        request(server)
            .get("/slow?delay=5")
            .set("x-sync-wait", "0.25")
            .set("Accept", "application/json")
            .expect(504, done);
    }).timeout(10000);

    it("slowapp default x-sync-wait final status 500", (done) => {
        request(server)
            .get("/slow?final_status=500&complete_in=0.5")
            .set("Accept", "application/json")
            .expect(res => {
                let cookies = res.res.rawHeaders.asMultiValue().cookies("set-cookie");
                assert.isDefined(cookies["poll-count"]);
                let poll_count = parseInt(cookies["poll-count"].split(";")[0].split("=")[1]);
                // this checks cookies are preserved through the poll cycle
                assert.isAbove(poll_count, 0);
            })
            .expect(500, done);
    }).timeout(10000);


    it("slowapp default x-sync-wait not complete", (done) => {
        request(server)
            .get("/slow?final_status=500&complete_in=5")
            .set("x-sync-wait", "1")
            .expect(504, done);
    }).timeout(10000);

});



describe("express with slowap with sub path", function () {
    var server;
    var slow_server;
    var env;
    before(function () {
        env = process.env;
        let app = require("./app");
        app.setup({
            UPSTREAM: "http://localhost:9003/sub",
            LOG_LEVEL: (process.env.NODE_ENV === "test" ? "warn": "debug"),
            VERSION_INFO: "{\"test\": 123}"
        });
        server = app.start();

        let slowapp = require("../../async-slowapp/src/app");
        slowapp.setup({BASE_URI: "http://localhost:9003/sub", LOG_LEVEL: (process.env.NODE_ENV === "test" ? "warn": "debug")});
        slow_server = slowapp.start({PORT: 9003})
    });

    beforeEach(function () {

    });
    afterEach(function () {

    });
    after(function () {
        process.env = env;
        slow_server.close();
        server.close();
    });

    it("responds to /_status", (done) => {
        request(server)
            .get("/_status")
            .expect(200, {
                status: "pass",
                ping: "pong",
                service: "sync-wrap",
                _version: {test: 123}
            })
            .expect("Content-Type", /json/, done);
    });

    it("it times out if syncwait shorter than initial response", (done) => {
        request(server)
            .get("/slow?delay=5")
            .set("x-sync-wait", "0.25")
            .set("Accept", "application/json")
            .expect(504, done);
    }).timeout(10000);

    it("slowapp default x-sync-wait final status 500", (done) => {
        request(server)
            .get("/slow?final_status=500&complete_in=0.5")
            .set("Accept", "application/json")
            .expect(res => {
                let cookies = res.res.rawHeaders.asMultiValue().cookies("set-cookie");
                assert.isDefined(cookies["poll-count"]);
                let poll_count = parseInt(cookies["poll-count"].split(";")[0].split("=")[1]);
                // this checks cookies are preserved through the poll cycle
                assert.isAbove(poll_count, 0);
            })
            .expect(500, done);
    }).timeout(10000);


    it("slowapp default x-sync-wait not complete", (done) => {
        request(server)
            .get("/slow?final_status=500&complete_in=5")
            .set("x-sync-wait", "1")
            .expect(504, done);
    }).timeout(10000);

    // it("slowapp patch request", (done) => {
    //     request(server)
    //         .patch("/slow?final_status=500&complete_in=5")
    //         .set("x-sync-wait", "1")
    //         .expect("Content-Location", /^http:\/\/localhost:9003\/sub\/poll\?id=.*/)
    //         .expect(202, done);
    // }).timeout(10000);

});
