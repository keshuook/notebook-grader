import { PDFParse } from "pdf-parse";
import { GoogleGenAI } from "@google/genai";
import process from "process";
import express from "express";
import multer from "multer";
import {config} from "./config.js"
import { JupyterAPI } from "./jupyter-api.js";
import { executeNBTool } from "./jupyter-tool.js";

const app = express();
const upload = multer();
const port = 3000;
const jupyter = new JupyterAPI("http://localhost:8888", "");

app.use(express.static("public"));
const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});

function notebookRepresentation(cells) {
  return cells
    .map((cell, index) => {
      const cellType = cell.cell_type;
      const content = cell.source.join("");
      return `CELL ${index + 1} [${cellType}]:\n${content}\n`;
    })
    .join("\n");
}

async function gradeNotebook(notebookContent, rubricContent) {
  const conversationHistory = [];
  const aiout = [];
  const cells = JSON.parse(notebookContent).cells;
  const formattedNotebook = notebookRepresentation(cells);

  conversationHistory.push({role: "user", parts: [{ text: formattedNotebook }]});

  let shouldGenerate = true;
  await jupyter.createSession();

  while(shouldGenerate) {
    console.log("Generating...");
    const res = await ai.models.generateContent({
      model: config.model,
      contents: conversationHistory,
      config: {
        temperature: 0,
        tools: [{functionDeclarations: [executeNBTool]}],
        systemInstruction: {
          parts: [{ text: `${config.systemPrompt}
You are to grade the notebooks based on the following rubric.
${rubricContent}` }]
        }
      }
    });

    const functionCalls = res.functionCalls;
    shouldGenerate = functionCalls && functionCalls.length > 0;
    
    if (res.text) aiout.push(res.text);

    const modelParts = [];
    if (res.text) {
        modelParts.push({ text: res.text });
    }
    // Only add functionCalls if they exist
    if (functionCalls && functionCalls.length > 0) {
        functionCalls.forEach(call => {
            modelParts.push({ functionCall: call });
        });
    }
    
    conversationHistory.push({ role: "model", parts: modelParts });

    if(shouldGenerate) {
      const functionParts = [];
      
      for (const call of functionCalls) {
        if(call.name == "run_notebook_cell") {
          console.log(`> Executing cell ${call.args.cell_index}...`);
          
          await jupyter.createSession();
          
          let index = 0;
          // Safety check: ensure input_value exists
          const inputs = call.args.input_value || [];
          
          // Get source properly
          const source = Array.isArray(cells[call.args.cell_index].source) 
              ? cells[call.args.cell_index].source.join("") 
              : cells[call.args.cell_index].source;

          const output = await jupyter.executeCodeblock(source, (prompt) => {
            return inputs[index++] || ''; 
          });

          console.log(`> Output: ${output.substring(0, 50)}...`);

          functionParts.push({
              functionResponse: {
                name: "run_notebook_cell",
                response: { result: output } 
              }
          });
        }
      }

      // Only push function role if we actually executed something
      if (functionParts.length > 0) {
          conversationHistory.push({role: "function", parts: functionParts});
      }
    }
  }

  jupyter.shutdownSession();
  return aiout.join("\n");
};

const uploadMiddleware = upload.fields([
  { name: "notebook", maxCount: 3 },
  { name: "rubric", maxCount: 1 },
]);
app.post("/grade", uploadMiddleware, async (req, res) => {
  try {
      const parsedRubric = new PDFParse({ data: req.files["rubric"][0].buffer });
      const rubricContent = await parsedRubric.getText();
      const notebookContent = req.files['notebook'][0].buffer.toString('utf-8');
      if (!notebookContent || !rubricContent) {
          return res.status(400).json({ error: "Missing notebook or rubric file." });
      }

      const result = await gradeNotebook(notebookContent, rubricContent);
      res.json({aiOut: result});
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: "An error occurred while grading." });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
