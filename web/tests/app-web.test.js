const request = require("supertest");
const app = require("../app-web");

describe("WEB", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("GET /health returns health response", async () => {
        const response = await request(app).get("/health");

        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty("status");
        expect(response.body).toHaveProperty("build");
        expect(response.body).toHaveProperty("commit");
    });

    test("GET / returns WEB message and API data", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                message: "Hello from API"
            })
        });

        const response = await request(app).get("/");

        expect(response.statusCode).toBe(200);
        expect(response.body.message).toBe("Hello from WEB");
        expect(response.body.api.message).toBe("Hello from API");
        expect(global.fetch).toHaveBeenCalledWith("http://api:3000");
    });

    test("GET / returns 502 when API returns an error", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 500
        });

        const response = await request(app).get("/");

        expect(response.statusCode).toBe(502);
        expect(response.body.error).toBe("Unable to reach API");
    });

    test("GET / returns 502 when API is unreachable", async () => {
        global.fetch = jest.fn().mockRejectedValue(
            new Error("API unreachable")
        );

        const response = await request(app).get("/");

        expect(response.statusCode).toBe(502);
        expect(response.body.error).toBe("Unable to reach API");
    });
});