import { SessionManager, KernelManager, ServerConnection } from '@jupyterlab/services';
import { WebSocket } from 'ws';

global.WebSocket = WebSocket;

class JupyterAPI {
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
      baseUrl,
      token,
      WebSocket: WebSocket
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
    await this.#kernelManager.ready;
    await this.#sessionManager.ready;

    this.#session = await this.#sessionManager.startNew({
      path: 'autograder-scratchpad.ipynb',
      type: 'notebook',
      name: 'python3'
    });
  }

  /**
   * Executes code and returns a comprehensive output object
   * @param {string} code 
   * @param {string} inputReply - Optional input to inject if code asks for input()
   */
  async executeCodeblock(code, inputCallback) {
    if (!this.#session) throw new Error("Session not initialized. Call createSession() first.");

    const future = this.#session.kernel.requestExecute({ code });
    
    // We must accumulate outputs because a single cell can print multiple times
    const output = [];

    // Handle User Input Requests
    future.onStdin = async (msg) => {
        if (msg.header.msg_type === 'input_request') {
          this.#session.kernel.sendInputReply({ value: await inputCallback(msg.content.prompt) }, msg.header);
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

// Usage Example
(async () => {
    const api = new JupyterAPI('http://localhost:8888');
    await api.createSession();

    const code = `x = input("Enter a first name: ")
print(x + "? Got it!")
y = input("Enter a last name: ")
print(y + "? Got it!")`

    const result = await api.executeCodeblock(code, (msg) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve((["Jame", "Jack", "Arnold", "Butler", "Muffin", "Gang"])[Math.floor(Math.random()*6)]);
        }, 500);
      })
    });
    
    console.log(result);

    console.log(await api.executeCodeblock(`print(x+y)`));

    api.shutdownAPI();
})();