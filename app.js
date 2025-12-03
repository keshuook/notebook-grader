import { PDFParse } from "pdf-parse";
import { GoogleGenAI } from "@google/genai";
import process from "process";
import express from "express";
import multer from "multer";

const app = express();
const upload = multer();
const port = 3000;

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
  const data = JSON.parse(notebookContent);
  const cells = data.cells;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `RUBRIC: ${rubricContent}
    NOTEBOOK: ${notebookRepresentation(cells)}`,
    config: {
      systemInstruction: `You are an expert code reviewer.
        Review the following Jupyter notebook submission according to the provided rubric.
        Provide detailed feedback on each code cell, highlighting strengths and areas for
        improvement based on the rubric criteria.
        
        Your response should be short and succinct. It should be composed of a mark from 0 to 100%, followed by a breakdown of the marks per cell`,
      temperature: 0,
    },
  });

  const grade = response.text.slice(0, response.text.indexOf('%') + 1)
  const justification = response.text.slice(response.text.indexOf('%') + 1);
  return { grade, justification };
}

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
      res.json(result);
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: "An error occurred while grading." });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
