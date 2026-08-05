/**
 * Base Class for Agent Tools
 * Provides standard interface for tool registration, parameter declaration, and execution.
 */

export class BaseTool {
  constructor(name, description, parameters = {}) {
    this.name = name;
    this.description = description;
    this.parameters = parameters;
  }

  /**
   * Executes the tool with given arguments
   * @param {Object} args 
   * @returns {Promise<any>}
   */
  async execute(args) {
    throw new Error(`Tool ${this.name} execute method not implemented.`);
  }

  /**
   * Returns Gemini Function Declaration format
   */
  toDeclaration() {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters
    };
  }
}
