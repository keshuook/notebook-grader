import { PDFParse } from "pdf-parse";
import { readFile } from "fs/promises";
import { GoogleGenAI } from "@google/genai";
import { executeNBTool } from "./jupyter-tool.js";
import { JupyterAPI } from "./jupyter-api.js";

// Constants to change

const rubricFilePath = "./Python for Data Science _ Assignment_1.pdf";
const notebookFilePath = "./assets/notebooks/A.ipynb";
const model = "gemini-2.5-flash";
const systemPrompt = `You are an expert code reviewer.
Review the following Jupyter notebook submission according to the provided rubric. Use the 'run_notebook_cell' tool to run a cell in the jupyter notebook and verify that it works. This tool takes the cell number and an array of inputs that are to be passed to the notebook.`

// Setup Jupyter API

const jupyter = new JupyterAPI("http://localhost:8888", "");

// PDF Reading Logic

const getRubric = async () => {
  const parser = new PDFParse({data: await readFile(rubricFilePath)});
  const data = (await parser.getText()).text;
  await parser.destroy();
  return data;
}

// Notebook Formatter

function notebookRepresentation(cells) {
  return cells
    .map((cell, index) => {
      const cellType = cell.cell_type;
      const content = cell.source.join("");
      return `CELL ${index} [${cellType}]:\n${content}\n`;
    })
    .join("\n");
}

// Gemini API Logic

const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
const conversationHistory = [];

gradeNotebook();