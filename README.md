# notebook-grader

An AI powered python notebook grader.

## Cost

This project is coded to use the Google API. When tested with the example notebooks (which can be found in the assets folder of this repository), it was found that 5 requests were made to the model, and ~8650 input tokens were required. Thus, the total evaluation cost (input tokens only) is $0.0025 for such a notebook.

Here is complete data I gathered for making a request with a notebook with 2 questions. (Note how every request has about 200 more input tokens than the previous. This is because each new request has to keep the memory of the previous requests, therefore grading notebooks with more questions becomes a lot more expensive).

|Request|Input|Thought|Output|
|-|-|-|-|
|Request 1|1075|341|42|
|Request 2|1239|247|128|
|Request 3|1400|0|85|
|**Total**|**3714**|**588**|**255**|

**Total Price for Grading 2 Cell Notebook:**

Note, according to the [pricing table](https://ai.google.dev/gemini-api/docs/pricing), 1 million input tokens for gemini-2.5-flash cost $0.30 and 1 million output tokens costs $2.50.

Input: $$\frac{0.3}{10^6} * 3714 = \$ 0.0011142$$
Output: $$\frac{2.5}{10^6} * (588 + 255) = \$ 0.0021075$$

Thus, the whole notebook was evaluated for $0.003.

## How to setup

First clone the repo.

```sh
git clone https://github.com/keshuook/notebook-grader.git
```

Now create a `.env` file with the Google AI API key.

```env
GEMINI_API_KEY=<TOKEN>
```

Next, make sure you have jupyter notebook installed, and start a server with the following command. Make sure it is hosted on port 8888.

```sh
jupyter notebook --NotebookApp.token='' --NotebookApp.password='' --NotebookApp.disable_check_xsrf=True
```

Finally, run the script with

```sh
npm start
```

## About Project

Here is a snippet of the system prompt which is fed into the AI.

```txt
You are a code reviewer that reviews student code submissions. Read Jupyter notebook submission and check wether the code runs without errors. To check if code runs without errors, use the 'run_notebook_cell' tool to run a cell in the jupyter notebook and verify that it works. This tool takes the cell number and an array of inputs that are to be passed to the notebook. Your output must consist of extremely concise comments as well as a breakup of the grade question-wise based on the above rubric, and the final grade. Output a JSON object for each question with the following keys:
"feedback": this contains one-line written feedback on the errors.
"number_of_minor_errors": this contains the number of minor errors. Minor errors are runtime errors that occur only for certain inputs.
"number_of_major_errors": this contains the number of severe runtime errors and any compile time errors. Incorrect output also is considered a major error.
"correctness": A number between 0 and 10 where 10 is where program logic is corrct (even if there are errors) and 0 is program logic is completetely incorrect.
"descriptive_comments": This counts the number of descriptive comments in the program.
```

This forces the AI model to output a JSON object for each question. This JSON output is used to calculate the grade based on the following criteria.

|Component|Weightage|
|---------|---------|
|Correctness|45%|
|Without Error|45%|
|Use of Comments|10%|

### The Grader Function

```js
function getGrade(json) {
  let correctness = Math.max(Math.min(0.45*json.correctness, 4.5), 0);
  let executes = json.number_of_major_errors > 0 ? 0 : Math.max(0, (4.5 - (1.5 * json.number_of_minor_errors)));
  let readiblity = Math.min(1, 0.5*json.descriptive_comments);

  return correctness + executes + readiblity;
}
```

### Sample Output from Gemini

```js
"aiout": ['```json{"Question 1": {"feedback": "The calculator program works correctly for the given inputs. No descriptive comments were found.","number_of_minor_errors": 0,"number_of_major_errors": 0,"correctness": 10,"descriptive_comments": 0}}```','```json{"Question 2": {"feedback": "The BMI calculator works correctly for the given inputs. No descriptive comments were found.","number_of_minor_errors": 0,"number_of_major_errors": 0,"correctness": 10,"descriptive_comments": 2}}```', '```json{"Question 3a": {"feedback": "The program correctly extracts unique dictionary values. No descriptive comments were found.","number_of_minor_errors": 0,"number_of_major_errors": 0,"correctness": 10,"descriptive_comments": 0}}```','```json{"Question 3b": {"feedback": "The variable \'repeated\' is not defined, leading to a NameError. The program logic for happy numbers is present but cannot execute due to this error.","number_of_minor_errors": 0,"number_of_major_errors": 1,"correctness": 7,"descriptive_comments": 0}}```']
```
