# notebook-grader

An AI powered python notebook grader.

How to run the notebook server.

```sh
jupyter notebook --NotebookApp.token='' --NotebookApp.password='' --NotebookApp.disable_check_xsrf=True
```

Sample Output from Gemini

```js
"aiout": ['```json{"Question 1": {"feedback": "The calculator program works correctly for the given inputs. No descriptive comments were found.","number_of_minor_errors": 0,"number_of_major_errors": 0,"correctness": 10,"descriptive_comments": 0}}```','```json{"Question 2": {"feedback": "The BMI calculator works correctly for the given inputs. No descriptive comments were found.","number_of_minor_errors": 0,"number_of_major_errors": 0,"correctness": 10,"descriptive_comments": 2}}```', '```json{"Question 3a": {"feedback": "The program correctly extracts unique dictionary values. No descriptive comments were found.","number_of_minor_errors": 0,"number_of_major_errors": 0,"correctness": 10,"descriptive_comments": 0}}```','```json{"Question 3b": {"feedback": "The variable \'repeated\' is not defined, leading to a NameError. The program logic for happy numbers is present but cannot execute due to this error.","number_of_minor_errors": 0,"number_of_major_errors": 1,"correctness": 7,"descriptive_comments": 0}}```']
```
