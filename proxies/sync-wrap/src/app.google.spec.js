
const request = require("supertest");
const assert = require("chai").assert;
const expect = require("chai").expect;

describe("failing test", function () {

    it("will always fail", (done) => {
        assert.isTrue(false);
        done()
    });
});


describe("express with google upstream and botli decompress", function () {
    var server;
    var env;
    before(function () {
        env = process.env;
        let app = require("./app");
        app.setup({UPSTREAM: "https://www.google.co.uk", LOG_LEVEL: (process.env.NODE_ENV === "test" ? "warn": "debug"), UNBOTLI: "true"});
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


    it("returns notfound for /madeup", (done) => {
        request(server)
            .get("/madeup")
            .expect(404, done);
    });

    it("returns good content for / with accept-encoding and User-Agent", (done) => {
        request(server)
            .get("/")
            .set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9")
            .set("Accept-Encoding", "gzip, deflate, br")
            .set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.129 Safari/537.36")
            .expect(r => {
                expect(r.text).to.be.a("string").and.satisfy(body => body.startsWith("<!doctype html>"));
                assert.equal(r.headers["content-encoding"], "gzip");
            })
            .expect(200, done);
    });

    it("returns good content for / with chrome headers", (done) => {
        request(server)
            .get("/")
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
                expect(r.text).to.be.a("string").and.satisfy(body => body.startsWith("<!doctype html>"));
                assert.equal(r.headers["content-encoding"], "gzip");
            })
            .expect(200, done);
    });
});



describe("express with google upstream without botli decompress", function () {
    var server;
    var env;
    before(function () {
        env = process.env;

        let app = require("./app");
        app.setup({UPSTREAM: "https://www.google.co.uk", LOG_LEVEL: (process.env.NODE_ENV === "test" ? "warn": "debug"), UNBOTLI: "false"});
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

    it("returns content-encoding br / with accept-encoding and User-Agent", (done) => {
        request(server)
            .get("/")
            .set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9")
            .set("Accept-Encoding", "gzip, deflate, br")
            .set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.129 Safari/537.36")
            .expect(r => {
                assert.equal(r.headers["content-encoding"], "br");
            })
            .expect(200, done);
    });


});
