const request = require("supertest");

const WEB_URL = process.env.WEB_URL || "http://localhost:8085";

describe("WEB + API integration", () => {
    test("WEB successfully receives data from API", async () => {
        const response = await request(WEB_URL).get("/");

        expect(response.statusCode).toBe(200);
        expect(response.body.message).toBe("Hello from WEB");
        expect(response.body.api).toBeDefined();
        expect(response.body.api.message).toBe("Hello from API");
    }, 10000);
});