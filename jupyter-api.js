import { SessionManager, KernelManager, ServerConnection } from '@jupyterlab/services';

export class JupyterAPI {
  /** @type {ServerConnection.ISettings} */
  #serverSettings;
  /** @type {KernelManager} */
  #kernelManager;
  /** @type {SessionManager} */
  #sessionManager;
  /** @type {import('@jupyterlab/services').Session.ISessionConnection} */
  #session;

  constructor(baseUrl, token = '') {
    this.#serverSettings = ServerConnection.makeSettings({
      baseUrl: baseUrl,
      token: token
    });

    // Initialize Managers
    this.#kernelManager = new KernelManager({ serverSettings: this.#serverSettings });
    this.#sessionManager = new SessionManager({ 
      serverSettings: this.#serverSettings, 
      kernelManager: this.#kernelManager 
    });
  }

  async createSession() {
    // Ensure managers are ready
    console.log("[jupyter] Waiting for kernel manager...");
    await this.#kernelManager.ready;
    console.log("[jupyter] Waiting for session manager...");
    await this.#sessionManager.ready;
    console.log("[jupyter] Starting new session...");
    this.#session = await this.#sessionManager.startNew({
      path: 'autograder-scratchpad.ipynb',
      type: 'notebook',
      name: 'python3'
    });
    console.log("[jupyter] Session started.");
  }

  /**
   * Executes code and returns a comprehensive output object
   * @param {string} code 
   * @param {string} inputCallback - Optional callback function to send input if code asks for input()
   */
  async executeCodeblock(code, inputCallback) {
    if (!this.#session) throw new Error("Session not initialized. Call createSession() first.");

    const future = this.#session.kernel.requestExecute({ code });
    
    // We must accumulate outputs because a single cell can print multiple times
    const output = [];

    // Handle User Input Requests
    future.onStdin = async (msg) => {
        if (msg.header.msg_type === 'input_request') {
          output.push(msg.content.prompt);
          this.#session.kernel.sendInputReply({ value: inputCallback(msg.content.prompt) }, msg.header);
        }
    };

    // Handle Output Messages
    future.onIOPub = (msg) => {
      const type = msg.header.msg_type;
      const content = msg.content;

      switch (type) {
        case 'stream':
          // Standard stdout
          output.push(content.text);
          break;
          
        case 'execute_result':
          // The "return value" of the cell
          output.push(content.data['text/plain']);
          break;

        case 'error':
          // Runtime errors
          output.push(`${content.ename}: ${content.evalue}`);
          break;
      }
    };

    // Wait for execution to finish completely
    await future.done;
    
    return output.join("");
  }

  async shutdownSession() {
    if (this.#session) {
      await this.#session.shutdown();
      this.#session.dispose();
    }
  }

  async shutdownAPI() {
    await this.shutdownSession();
    this.#kernelManager.dispose();
    this.#sessionManager.dispose();
  }
}