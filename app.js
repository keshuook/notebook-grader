import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import process from "process";

const data = JSON.parse(fs.readFileSync("assets/submission1.ipynb", "utf-8"));
const rubric = fs.readFileSync("assets/rubric.txt", "utf-8");
const cells = data.cells;

function notebookRepresentation(cells) {
    return cells.map((cell, index) => {
        const cellType = cell.cell_type;
        const content = cell.source.join("");
        return `CELL ${index + 1} [${cellType}]:\n${content}\n`;
    }).join("\n");
}

console.log(notebookRepresentation(cells));

const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `RUBRIC: ${rubric}
    NOTEBOOK: ${notebookRepresentation(cells)}`,
    config: {
        systemInstruction: `You are an expert code reviewer.
        Review the following Jupyter notebook submission according to the provided rubric.
        Provide detailed feedback on each code cell, highlighting strengths and areas for
        improvement based on the rubric criteria.
        
        Your response should be short and succinct. It should be composed of a letter grade
        from A to F, followed by a brief justification (20 words) for the grade based on the rubric.`,
        temperature: 0.1,
    }
  });
  console.log(response.text);
}

await main();