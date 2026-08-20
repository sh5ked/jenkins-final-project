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

if (require.main === module) {
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`API listening on port ${PORT}`);
    });
}

module.exports = app;