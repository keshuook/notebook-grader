// --- STATE MANAGEMENT ---
const state = {
    question: null,
    queue: [], // Array of { id, file, status, content }
    isProcessing: false,
    grades: []
};

document.getElementById("output-grade-button").addEventListener("click", () => {
    const viewer = document.getElementById("viewer");
    viewer.innerHTML = "";
    viewer.appendChild(document.getElementById("grades"));
});

function downloadGrade() {
    const csv = "Name,Grade,Feedback\n".concat(state.grades.map(v => {
        return `${v.name},${v.grade},${v.feedback.replace(/\n/g, " ")}`;
    }).join("\n"));

    const blob = new Blob([csv], {type: "text/csv"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "grades.csv");
    document.body.appendChild(link);

    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function addGrade(name, json) {
    const table = document.createElement("table");
    table.classList.add("grade-table");
    
    const header = document.createElement("tr");
    const que = document.createElement("th");
    que.innerHTML = "Question";
    const grd = document.createElement("th");
    grd.innerHTML = "Grade";
    header.appendChild(que);
    header.appendChild(grd);
    table.appendChild(header);

    let grade = 0;
    let feedback = "";
    json.forEach(obj => {
        const tr = document.createElement("tr");
        const q = document.createElement("td");
        const g = document.createElement("td");
        q.innerHTML = obj.name;
        g.innerHTML = obj.grade;
        tr.appendChild(q);
        tr.appendChild(g);
        table.appendChild(tr);

        grade += obj.grade;
        feedback = feedback.concat(`${obj.name}
${obj.feedback}
`);
    });

    const tr = document.createElement("tr");
    tr.classList.add("total-row");
    const q = document.createElement("td");
    const g = document.createElement("td");
    q.innerHTML = "Total";
    g.innerHTML = grade;
    tr.appendChild(q);
    tr.appendChild(g);
    table.appendChild(tr);

    const grades = document.getElementById("grades");
    const h1 = document.createElement("h1");
    h1.innerHTML = name;
    h1.classList.add("grade-header");
    grades.appendChild(h1);
    grades.appendChild(table);

    state.grades.push({name, grade, feedback});
}

const ws = new WebSocket("http://localhost:3000");

function initSocket() {
    // Connect to backend
    ws.addEventListener('open', () => {
        log('System', 'Connected to server', 'success');
    });

    ws.addEventListener('message', (msg) => {
        const data = JSON.parse(msg.data);
        switch(data.header) {
            case "tab_conflict":
                document.getElementById('overlay').style.display = 'flex';
                ws.close();
                break;
            case "error":
                log('Backend Error', data.message, 'error');
                break;
            case "grade":
                state.isProcessing = false;
                const fileObj = state.queue.find(f => f.name === data.filename);
                if (fileObj) {
                    fileObj.status = 'done';
                    updateSidebar();
                }
                log("Grader", `Finished Grading ${data.filename}`, 'success');
                processQueue();
                break;
            case "grade_info":
                log("Grader", data.message, 'info');
                break;
            case "final_grade":
                if(JSON.parse(data.message).length == 0) {
                    log("System", `No questions were graded in ${data.filename}!`, 'error');
                }
                addGrade(data.filename, JSON.parse(data.message));
                break;
        }
    });
}


// Listen for Question Upload

document.getElementById('question-file').addEventListener('change', (e) => {
    state.question = e.target.files[0];
    log('System', `Question Paper loaded: ${state.question.name}`, 'info');
});

// Listen for Notebook Uploads
document.getElementById('notebook-file').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    
    for (let file of files) {
        // Read file content immediately for rendering
        const text = await file.text();
        let jsonContent = null;
        try { jsonContent = JSON.parse(text); } catch(e) { console.error(e); }

        state.queue.push({
            name: file.name,
            file: file,
            status: 'pending', // pending, grading, done, error
            content: jsonContent
        });
    }
    updateSidebar();
    processQueue();
});

// The Main Loop
function processQueue() {
    if (state.isProcessing) return;
    if (!state.question) { 
        log('Error', 'Please upload a question paper first!', 'error'); 
        return; 
    }

    const next = state.queue.find(f => f.status === 'pending');
    if (!next) return; // Nothing to do

    state.isProcessing = true;
    next.status = 'grading';
    updateSidebar();
    uploadAndGrade(next);
}

function uploadAndGrade(fileObj) {
    log('System', `Uploading ${fileObj.name}`, 'info');
    
    const formData = new FormData();
    formData.append('notebook', fileObj.file);
    formData.append('question_paper', state.question);

    fetch('/api/upload', { // Your express endpoint
        method: 'POST',
        body: formData
    })
    .then(res => {
        if (res.ok) log('System', 'Upload complete. Waiting for Grader.', 'success');
        else throw new Error('Upload failed');
    })
    .catch(err => {
        log('Error', err.message, 'error');
        fileObj.status = 'error';
        state.isProcessing = false;
        updateSidebar();
        processQueue(); // Skip to next
    });
}

// --- 3. UI RENDERING ---

function updateSidebar() {
    const list = document.getElementById('file-list');
    list.innerHTML = '';
    
    state.queue.forEach(item => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.innerHTML = `
            <span>${item.name}</span>
            <span class="status-icon">${getStatusIcon(item.status)}</span>
        `;
        div.onclick = () => renderNotebook(item);
        list.appendChild(div);
    });
}

function getStatusIcon(status) {
    if (status === 'pending') return '⏳';
    if (status === 'grading') return '⚙️';
    if (status === 'done') return '✅';
    return '❌';
}

function log(source, msg, type) {
    const logs = document.getElementById('logs');
    const line = document.createElement('div');
    line.innerHTML = `<span style="opacity:0.5">[${new Date().toLocaleTimeString()}]</span> <b>${source}:</b> <span class="log-${type}">${msg}</span>`;
    logs.appendChild(line);
    document.getElementById('console-panel').scrollTop = logs.scrollHeight;
}

function renderNotebook(item) {
    const viewer = document.getElementById('viewer');
    if (!item.content) {
        viewer.innerHTML = '<p>Error reading notebook content</p>';
        return;
    }

    let html = `<h1>${item.name}</h1><hr>`;
    
    item.content.cells.forEach(cell => {
        if (cell.cell_type === 'markdown') {
            // Join array of strings and parse Markdown
            const mdText = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
            html += `<div class="cell cell-markdown">${marked.parse(mdText)}</div>`;
        } 
        else if (cell.cell_type === 'code') {
            const codeText = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
            // Escape HTML to prevent injection, then highlight
            const safeCode = codeText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            
            html += `
                <div class="cell">
                    <div class="input-prompt">In [${cell.execution_count || ' '}]:</div>
                    <pre><code class="language-python">${safeCode}</code></pre>
                </div>
            `;
        }
    });

    viewer.innerHTML = html;
    hljs.highlightAll(); // Apply syntax highlighting
}

// Start
initSocket();