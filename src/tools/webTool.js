import { BaseTool } from './baseTool';

/**
 * Web Search Tool Stub
 */
export class WebSearchTool extends BaseTool {
  constructor() {
    super(
      'web_search',
      'Performs real-time web search for up-to-date information.',
      {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'The search query term' }
        },
        required: ['query']
      }
    );
  }

  async execute(args) {
    return {
      status: 'not_implemented',
      message: `Web search for "${args.query}" is not implemented yet.`
    };
  }
}

export const webSearchTool = new WebSearchTool();
