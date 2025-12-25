import { PDFParse } from "pdf-parse";
import express from "express";
import expressWS from "express-ws";
import multer from "multer";
import gradeNotebook from "./grader.js";


const port = 3000; // Frontend Port

// Express and multer setup.
const app = express();
app.use(express.static("public"));
expressWS(app);
let currentWS; // Only one client is allowed to connect

const upload = multer();

const uploadMiddleware = upload.fields([
  { name: "notebook", maxCount: 3 },
  { name: "rubric", maxCount: 1 },
]);

// Web Socket for error communication and progress communication

app.ws("/", (ws, req) => {
  if(currentWS) {
    ws.send(JSON.stringify({
      header: "tab_conflict"
    }));
    ws.close();
  } else {
    ws.on('close', () => {
      currentWS = null;
    });
    currentWS = ws;
  }

});

app.post("/api/upload", uploadMiddleware, async (req, res) => {
  try {
    const parsedRubric = new PDFParse({ data: req.files["rubric"][0].buffer });
    const rubricContent = await parsedRubric.getText();
    const notebookContent = req.files['notebook'][0].buffer.toString('utf-8');
    if (!notebookContent || !rubricContent) {
      return res.status(400).json({ error: "Missing notebook or rubric file." });
    }

    res.write("File Uploaded Successfully!");
    const result = await gradeNotebook(notebookContent, rubricContent, (msg) => {
      if(currentWS) currentWS.send(JSON.stringify({
        header: 'grade_info',
        message: msg
      }));
    });

    console.log(result);

    if(currentWS) currentWS.send(JSON.stringify({
      header: 'grade',
      filename: req.files['notebook'][0].originalname
    }));
  } catch (error) {
    console.error(error);
    if(currentWS) currentWS.send(JSON.stringify({
      header: 'error',
      message: error.message
    }));
    res.status(500).json({ error: "An error occurred while grading." });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
