"use strict";

const app = require("./app");


app.setup(process.env);


const main = app.start(process.env);

module.exports = {server: main};