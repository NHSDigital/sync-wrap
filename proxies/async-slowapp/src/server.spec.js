
const request = require("supertest");
const assert = require("chai").assert;
// const expect = require("chai").expect;

const sleep = (delay) => {
    return new Promise(resolve => {
        setTimeout(resolve, delay)
    });
};



describe("express with async-slowapp", function () {
    var server;
    var env;
    before(function () {
        env = process.env;
        let app = require("./server");
        app.setup({ LOG_LEVEL: "debug"});
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

    it("responds to /_ping", (done) => {
        request(server)
            .get("/_ping")
            .expect(200, {ping: "pong"})
            .expect("Content-Type", /json/, done);
    });

    it("responds not found to get /poll poll for missing id", (done) => {
        request(server)
            .get("/poll?id=madeup")
            .expect(404, done);
    });

    it("responds not found to delete /poll poll for missing id", (done) => {
        request(server)
            .delete("/poll?id=madeup")
            .expect(404, done);
    });

    it("responds to /slow with a new content-location", (done) => {
        request(server)
            .get("/slow")
            .expect("Content-Type", /json/)
            .expect(res => {
                let headers = res.res.rawHeaders.asMultiValue();
                assert.isTrue(headers.has('content-location'));
                let cookies = headers.cookies("set-cookie");
                assert.isDefined(cookies["poll-count"]);
                let poll_count = parseInt(cookies["poll-count"].split(";")[0].split("=")[1]);
                // this checks cookies are preserved through the poll cycle
                assert.equal(poll_count, 0);
            })
            .expect(200, done)

    });

    it("responds to /slow with a content-location and poll count increments", (done) => {
        let content_location;
        request(server)
            .get("/slow?complete_in=0.01&final_status=418")
            .expect("Content-Type", /json/)
            .expect(res => {
                let headers = res.res.rawHeaders.asMultiValue();
                assert.isTrue(headers.has('content-location'));
                content_location = headers['content-location'];
                let cookies = headers.cookies("set-cookie");
                assert.isDefined(cookies["poll-count"]);
                let poll_count = parseInt(cookies["poll-count"].split(";")[0].split("=")[1]);
                assert.equal(poll_count, 0);
            })
            .expect(200)
            .end(async ()=>{
                await sleep(500);
                let url = new URL(content_location);
                request(server)
                .get(url.pathname + url.search)
                .set("Cookie", "poll-count=0")
                .expect(res => {
                    let headers = res.res.rawHeaders.asMultiValue();
                    assert.isFalse(headers.has('content-location'));
                    let cookies = headers.cookies("set-cookie");
                    assert.isDefined(cookies["poll-count"]);
                    let poll_count = parseInt(cookies["poll-count"].split(";")[0].split("=")[1]);
                    assert.equal(poll_count, 1);
                })
                .expect(418, done);

            });

    });


});
