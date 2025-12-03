import { Type } from '@google/genai';
import { exec } from 'child_process';
import {writeFileSync} from 'fs';
import JupyterAPI from "./jupyter-api.js"

const executeNBTool = {
    name: "execute-cell",
    description: "This function takes in one input, the cell number. It executes the jupyter notebook cell and returns the output.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            cellNo: {
                type: Type.INTEGER,
                description: "The cell number of the cell that has to be executed."
            }
        }
    }
}

function executeNB(notebook, no, callback) {
    writeFileSync("tmp.py", notebook.cells[no].source.join(""));
    exec("python tmp.py", (err, stdout, stderr) => {
        callback(stdout);
    });
}

export {executeNB, executeNBTool};