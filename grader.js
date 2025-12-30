import { config } from "./config.js";
import { GoogleGenAI } from "@google/genai";
import { JupyterAPI } from "./jupyter-api.js";
import { executeNBTool } from "./jupyter-tool.js";
import process from "process";

const jupyter = new JupyterAPI("http://127.0.0.1:8888", ""); // Jupyter API
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

// Returns the grade, here is the rubric
function getGrade(json) {
  let correctness = Math.max(Math.min(0.45*json.correctness, 4.5), 0);
  let executes = json.number_of_major_errors > 0 ? 0 : Math.max(0, (4.5 - (1.5 * json.number_of_minor_errors)));
  let readiblity = Math.min(1, 0.5*json.descriptive_comments);

  return correctness + executes + readiblity;
}

// This function grades the notebook via the Gemini API

async function gradeNotebook(notebookContent, questionsContent, outCallback) {
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
Here are the questions you will be grading the notebooks on:
${questionsContent}` }]
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

  const gradeArr = [];

  aiout.forEach(raw => {
    const json = raw.startsWith("```json") ? JSON.parse(raw.substring(7, raw.length - 3)) : JSON.parse(raw);
    for (let x in json) {
      const currentJSON = json[x];
      currentJSON['name'] = x;
      currentJSON['grade'] = getGrade(json[x]);
      gradeArr.push(currentJSON);
    }
  });

  return gradeArr;
};

export default gradeNotebook;