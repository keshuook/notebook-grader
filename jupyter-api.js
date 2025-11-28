import { SessionManager, KernelManager, ServerConnection } from '@jupyterlab/services';import { WebSocket } from 'ws';

global.WebSocket = WebSocket; 

async function gradeNotebook() {
  console.log('Connecting to Jupyter Server...');

  // 1. Create the settings object using the factory method
  // This fixes your "reading 'cache'" error by populating defaults (init, headers, etc.)
  const serverSettings = ServerConnection.makeSettings({
    baseUrl: 'http://localhost:8888', // Ensure this matches your running server
    token: '',              // Ensure this matches your running server token
    WebSocket: WebSocket              // Explicitly pass WebSocket (optional if global is set, but good practice)
  });

  // 2. Start the Session Manager
  const kernelManager = new KernelManager({ serverSettings });
  const sessionManager = new SessionManager({ serverSettings, kernelManager });

  try {
    console.log('Starting new kernel session...');
    
    // 3. Create a new session (starts a Python 3 kernel)
    const session = await sessionManager.startNew({
      path: 'autograder-scratchpad.ipynb', // This file doesn't need to exist, it's a virtual path
      type: 'notebook',
      name: 'python3'
    });

    console.log('Session started! ID:', session.id);

    // 4. Execute Code
    const code = "x = 5";
    const future = session.kernel.requestExecute({ code });
    const future2 = session.kernel.requestExecute({ code: 'input("Hello")' });

    // 5. Handle Output
    [future, future2].forEach((f, i) => {
        f.onIOPub = (msg) => {
            const msgType = msg.header.msg_type;
            const content = msg.content;

            // 1. Standard Print Output
            if (msgType === 'stream') {
            console.log(`[STDOUT]: ${content.text}`);
            } 
            // 2. Implicit "Last Line" Result (e.g. x + y)
            else if (msgType === 'execute_result') {
            // Data often comes in multiple formats (plain text, html, json)
            // We usually just want text/plain for grading logic
            console.log(`[RESULT]: ${content.data['text/plain']}`);
            } 
            // 3. Rich Display (e.g. explicit display(df), matplotlib plots)
            else if (msgType === 'display_data') {
            console.log(`[DISPLAY]: Data of type ${Object.keys(content.data).join(', ')} received.`);
            // console.log(content.data['text/plain']); // Uncomment to see text rep
            }
            // 4. Runtime Errors
            else if (msgType === 'error') {
            console.error(`[ERROR]: ${content.evalue}`);
            }
        };

        // B. Handle INPUT Requests
        f.onStdin = (msg) => {
            if (msg.header.msg_type === 'input_request') {
            console.log(`[INPUT REQUEST]: Kernel asked: "${msg.content.prompt}"`);
            
            if (inputToInject !== null) {
                console.log(`[INPUT SENT]: Sending reply -> "${inputToInject}"`);
                // Send the reply back to the kernel to unpause it
                session.kernel.sendInputReply({ value: inputToInject });
            } else {
                console.error("Kernel asked for input, but none was provided in arguments!");
                // Sending empty string to prevent infinite hang
                session.kernel.sendInputReply({ value: '' }); 
            }
            }
        };
    });

    await future.done;
    console.log('Execution complete.');

    // Clean up
    await session.shutdown();

  } catch (err) {
    console.error('Error during execution:', err);
  }
}

gradeNotebook();