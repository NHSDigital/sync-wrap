
const request = require("supertest");
const assert = require("chai").assert;
// const expect = require("chai").expect;


describe("express with slowapp no insecure", function () {
    var server;
    var env;
    before(function () {
        env = process.env;
        let app = require("./server");
        app.setup({UPSTREAM: "https://localhost:9003", ALLOW_INSECURE: "false", LOG_LEVEL: "debug"});
        server = app.server;
    });

    beforeEach(function () {

    });
    afterEach(function () {

    });
    after(function () {
        process.env = env;
        server.close();
    });

    it("responds to /self-ping", (done) => {
        request(server)
            .get("/self-ping")
            .expect(200, {ping: "pong"})
            .expect("Content-Type", /json/, done);
    });

    it("responds to /ping upstream", (done) => {
        request(server)
            .get("/ping")
            .expect(502, done);
    });
});


describe("express with slowap", function () {
    var server;
    var env;
    before(function () {
        env = process.env;
        let app = require("./server");
        app.setup({UPSTREAM: "https://localhost:9003", ALLOW_INSECURE: "true", LOG_LEVEL: "debug"});
        server = app.server;
    });

    beforeEach(function () {

    });
    afterEach(function () {

    });
    after(function () {
        process.env = env;
        server.close();
    });

    it("responds to /self-ping", (done) => {
        request(server)
            .get("/self-ping")
            .expect(200, {ping: "pong"})
            .expect("Content-Type", /json/, done);
    });

    it("responds to /_ping upstream", (done) => {
        request(server)
            .get("/_ping")
            .expect(200, done);
    });

    it("it times out if syncwait shorter than initial response", (done) => {
        request(server)
            .get("/slow?delay=5&syncWait=0.25")
            .set("Accept", "application/json")
            .expect(504, done);
    }).timeout(10000);

    it("slowapp default syncWait final status 500", (done) => {
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


    it("slowapp default syncWait not complete", (done) => {
        request(server)
            .get("/slow?final_status=500&complete_in=5&syncWait=1")
            .expect("Content-Location", /^http:\/\/localhost:9003\/poll\?id=.*/)
            .expect(202, done);
    }).timeout(10000);

});



describe("express with slowap with sub path", function () {
    var server;
    var env;
    before(function () {
        env = process.env;
        let app = require("./server");
        app.setup({UPSTREAM: "https://localhost:9003/sub", ALLOW_INSECURE: "true", LOG_LEVEL: "debug"});
        server = app.server;
    });

    beforeEach(function () {

    });
    afterEach(function () {

    });
    after(function () {
        process.env = env;
        server.close();
    });

    it("responds to /self-ping", (done) => {
        request(server)
            .get("/self-ping")
            .expect(200, {ping: "pong"})
            .expect("Content-Type", /json/, done);
    });

    it("responds to /_ping upstream", (done) => {
        request(server)
            .get("/_ping")
            .expect(200, done);
    });

    it("it times out if syncwait shorter than initial response", (done) => {
        request(server)
            .get("/slow?delay=5&syncWait=0.25")
            .set("Accept", "application/json")
            .expect(504, done);
    }).timeout(10000);

    it("slowapp default syncWait final status 500", (done) => {
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


    it("slowapp default syncWait not complete", (done) => {
        request(server)
            .get("/slow?final_status=500&complete_in=5&syncWait=1")
            .expect("Content-Location", /^http:\/\/localhost:9003\/sub\/poll\?id=.*/)
            .expect(202, done);
    }).timeout(10000);

});
