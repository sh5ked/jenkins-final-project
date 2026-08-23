const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.json({
        message: "Hello from API"
    });
});

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        build: process.env.BUILD_NUMBER || "local",
        commit: process.env.GIT_COMMIT
            ? process.env.GIT_COMMIT.substring(0, 7)
            : "local"
    });
});

function sabotageCoverage() {
    console.log("unused 1");
    console.log("unused 2");
    console.log("unused 3");
    console.log("unused 4");
    console.log("unused 5");
    console.log("unused 6");
    console.log("unused 7");
    console.log("unused 8");
    console.log("unused 9");
    console.log("unused 10");
    console.log("unused 11");
    console.log("unused 12");
    console.log("unused 13");
    console.log("unused 14");
    console.log("unused 15");
    console.log("unused 16");
    console.log("unused 17");
    console.log("unused 18");
    console.log("unused 19");
    console.log("unused 20");
    console.log("unused 21");
    console.log("unused 22");
    console.log("unused 23");
    console.log("unused 24");
    console.log("unused 25");
    console.log("unused 26");
    console.log("unused 27");
    console.log("unused 28");
    console.log("unused 29");
    console.log("unused 30");
}

if (require.main === module) {
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`API listening on port ${PORT}`);
    });
}

module.exports = app;