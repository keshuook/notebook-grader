document.getElementById('grade-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const notebookFile = document.getElementById('notebook-file').files;
    const rubricFile = document.getElementById('rubric-file').files[0];
    const resultDiv = document.getElementById('result');
    const gradeDiv = document.getElementById('grade');
    const justificationDiv = document.getElementById('justification');

    if (!notebookFile || !rubricFile) {
        alert('Please select both files.');
        return;
    }

    const formData = new FormData();
    for (let k of notebookFile) {
        formData.append('notebook', k);
    }
    formData.append('rubric', rubricFile);

    resultDiv.classList.add('hidden');

    try {
        const response = await fetch('/grade', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error('An error occurred while grading.');
        }

        const result = await response.json();
        gradeDiv.textContent = `Grade: ${result.grade}`;
        justificationDiv.textContent = result.justification;
        resultDiv.classList.remove('hidden');
    } catch (error) {
        console.error(error);
        alert(error.message);
    }
});