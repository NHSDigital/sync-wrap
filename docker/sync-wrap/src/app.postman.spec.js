
const request = require("supertest");
const assert = require("chai").assert;
// const expect = require("chai").expect;


describe("express with fake domain", function () {
    var server;
    var env;
    before(function () {
        env = process.env;
        let app = require("./app");
        app.setup({UPSTREAM: "https://localhost:1234", ALLOW_INSECURE: "true", LOG_LEVEL: (process.env.NODE_ENV === "test" ? "warn": "debug")});
        server = app.start();
    });

    beforeEach(function () {

    });
    afterEach(function () {

    });
    after(function () {
        process.env = env;
        server.close();
    });

    it("returns bad gateway", (done) => {
        request(server)
            .get("/ping")
            .expect(502, done);
    });
});

describe("express with postman-echo", function () {
    var server;
    var env;
    before(function () {
        env = process.env;
        let app = require("./app");
        app.setup({UPSTREAM: "https://postman-echo.com", LOG_LEVEL: (process.env.NODE_ENV === "test" ? "warn": "debug")});
        server = app.start();
    });
    
    beforeEach(function () {

    });
    afterEach(function () {

    });
    after(function () {
        process.env = env;
        server.close();
    });

    it("responds to /_status", (done) => {
        request(server)
            .get("/_status")
            .expect(200, {ping: "pong"})
            .expect("Content-Type", /json/, done);
    });

    it("passes multiple path segments", (done) => {
        request(server).get("/response-headers/fake-path").expect(404, done);
    });

    it("supports multi-value response headers other than set-cookie", (done) => {
        request(server)
            .get("/response-headers?foo=bar1&foo=bar2#things")
            .expect("Content-Type", /json/)
            .expect(200, {foo:["bar1","bar2"]})
            .expect((res) => {
                if (res.error !== false) throw res.error;
                let headers = res.res.rawHeaders.asMultiValue();
                assert.deepEqual(headers.foo, ["bar1", "bar2"]);
            })
            .end(done);
    });

    it("sets request headers", (done) => {
        request(server)
        .get("/headers")
        .set("Accept", "application/json")
        .set("myheader", "1234")
        .set("user-agent", "mattagent")
        .set("foo", ["bar1", "bar2"])
        .expect((res) => {
            let headers = res.body.headers;

            assert.equal(headers.accept, "application/json");
            assert.equal(headers.myheader, "1234");
            assert.equal(headers["user-agent"], "mattagent");
            assert.equal(headers["x-sync-wrapped"], "true");
            // todo: postman echo concats these so should check elsewhere
            assert.equal(headers.foo, "bar1, bar2");
        })
        .expect(200, done);
    });

    it("passes cookies", (done) => {
        request(server)
            .get("/cookies")
            .set("Cookie", "mycookie=1235")
            .set("Accept", "application/json")
            .expect("Content-Type", /json/)
            .expect(200, {cookies:{mycookie:"1235"}},  done);


    });

    it("retrieves cookies", (done) => {
        request(server)
            .get("/cookies/set?mycookie=1235&mycookie2=123")
            .expect(res=>{
                let headers = res.res.rawHeaders.asMultiValue();
                assert.include(headers["set-cookie"], "mycookie=1235; Path=/");
                assert.include(headers["set-cookie"], "mycookie2=123; Path=/");
            })
            .expect(302,  done);


    });

    it("passes post data ", (done) => {
        request(server)
            .post("/post")
            .send({test: "bob"})
            .set("Accept", "application/json")
            .expect("Content-Type", /json/)
            .expect((res) => {
                if (res.error !== false) throw res.error;
                assert.deepEqual(res.body.json, {test: "bob"});
            })
            .expect(200, done);
    });

    it("handles streamed response ", (done) => {
        request(server)
            .get("/stream/5")
            .set("Accept", "application/json")
            .expect((res) => {
                if (res.error !== false) throw res.error;
                // todo: can this test be better?
                assert.isAbove(res.text.length, 0);
            })
            .expect(200, done);
    });

    it("it validates x-sync-wait is a number", (done) => {
        request(server)
            .get("/delay/3")
            .set("x-sync-wait", "eek")
            .set("Accept", "application/json")
            .expect(400, {err: "x-sync-wait should be a number between 0.25 and 29"}, done);
    });

    it("it validates x-sync-wait is > lower bound", (done) => {
        request(server)
            .get("/delay/3")
            .set("x-sync-wait", "0.0001")
            .set("Accept", "application/json")
            .expect(400, {err: "x-sync-wait should be a number between 0.25 and 29"}, done);
    });

    it("it validates x-sync-wait is < upper bound", (done) => {
        request(server)
            .get("/delay/3")
            .set("x-sync-wait", "30")
            .set("Accept", "application/json")
            .expect(400, {err: "x-sync-wait should be a number between 0.25 and 29"}, done);
    });

    it("it times out if x-sync-wait shorter than initial response", (done) => {
        request(server)
            .get("/delay/3")
            .set("x-sync-wait", "0.25")
            .set("Accept", "application/json")
            .expect(504, done);
    });

    it("it allows 202  response passthrough if respond-async is set", (done) => {
        request(server)
            .get("/status/202")
            .set("Prefer", "respond-async")
            .set("Accept", "application/json")
            .expect(202, done);
    });

    it("it returns gzip content", (done) => {
        request(server)
            .get("/gzip")
            .set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9")
            .set("Accept-Encoding", "gzip, deflate, br")
            .set("Cache-Control", "no-cache")
            .set("Connection", "keep-alive")
            .set("Pragma", "no-cache")
            .set("Sec-Fetch-Dest", "document")
            .set("Sec-Fetch-Mode", "navigate")
            .set("Sec-Fetch-Site", "none")
            .set("Sec-Fetch-User", "?1")
            .set("Upgrade-Insecure-Requests", "1")
            .set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.129 Safari/537.36")
            .expect(r => {
                assert.equal(r.headers["content-encoding"], "gzip");
                assert.isTrue(r.body.gzipped);
            })
            .expect(200, done);
    });
});
