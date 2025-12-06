import { Type } from '@google/genai';

const executeNBTool = {
    name: "run_notebook_cell",
    description: "Executes a specific code cell in the Jupyter Notebook. Use this to run student code or test logic.",
    parameters: {
        type: "OBJECT",
        properties: {
        cell_index: {
            type: Type.NUMBER,
            description: "The 0-based index of the cell to run."
        },
        input_value: {
            type: Type.ARRAY,
            items: {type: Type.STRING},
            description: "If the cell calls input(), provide the text response(s) here. Defaults to empty string if omitted."
        }
        },
        required: ["cell_index"]
    }
}

export {executeNBTool};