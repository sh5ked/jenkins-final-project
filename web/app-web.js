const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;
const API_URL = "http://wrong-api:3000";

app.get("/", async (req, res) => {
    try {
        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error(`API returned status ${response.status}`);
        }

        const data = await response.json();

        res.json({
            message: "Hello from WEB",
            api: data
        });
    } catch (error) {
        res.status(502).json({
            error: "Unable to reach API"
        });
    }
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
        console.log(`WEB listening on port ${PORT}`);
    });
}

module.exports = app;