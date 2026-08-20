const request = require("supertest");
const app = require("../app");

describe("API", () => {
    test("GET / returns API message", async () => {
        const response = await request(app).get("/");

        expect(response.statusCode).toBe(200);
        expect(response.body.message).toBe("Hello from API");
    });

    test("GET /health returns ok", async () => {
        const response = await request(app).get("/health");

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe("ok");
    });
});