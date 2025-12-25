import {config} from "./config.js";
import { GoogleGenAI } from "@google/genai";
import { JupyterAPI } from "./jupyter-api.js";
import { executeNBTool } from "./jupyter-tool.js";
import process from "process";

const jupyter = new JupyterAPI("http://localhost:8888", ""); // Jupyter API
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

// This function grades the notebook via the Gemini API

async function gradeNotebook(notebookContent, rubricContent, outCallback) {
  const conversationHistory = []; // Maintain the conversation history
  const aiout = []; // List of all comments
  const cells = JSON.parse(notebookContent).cells; // Jupyter Notebook Cells represented as JSON Object
  const formattedNotebook = notebookRepresentation(cells); // Jupyter Notebook as plain text prompt

  conversationHistory.push({role: "user", parts: [{ text: formattedNotebook }]}); // Populate the conversation with the jupyter notebook as the "user" prompt.

  try {
    await jupyter.createSession(); // To run the jupyter notebook
  } catch (err) {
    throw new Error("Could not Initialize Jupyter Session.");
  }

  let shouldGenerate = true;

  while(shouldGenerate) {
    const res = await ai.models.generateContent({
      model: config.model,
      contents: conversationHistory,
      config: {
        temperature: 0,
        tools: [{functionDeclarations: [executeNBTool]}],
        systemInstruction: {
          parts: [{ text: `${config.systemPrompt}
Here is the question paper for reference:
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
          outCallback(`Executing cell ${call.args.cell_index}`);
                    
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

          outCallback(`Output: ${output.substring(0, 200)}`);

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

export default gradeNotebook;