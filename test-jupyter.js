import { JupyterAPI } from "./jupyter-api.js";

async function test() {
    console.log("Testing Jupyter Connection...");
    try {
        const api = new JupyterAPI("http://127.0.0.1:8888", "");
        await api.createSession();
        const result = await api.executeCodeblock("print('Hello from Jupyter')", () => { });
        console.log("Result:", result);
        await api.shutdownAPI();
        console.log("Test Passed!");
    } catch (error) {
        console.error("Test Failed:", error);
    }
}

test();
