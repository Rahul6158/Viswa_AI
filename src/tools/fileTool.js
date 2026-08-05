import { BaseTool } from './baseTool';

/**
 * File System Tool Stub
 */
export class FileSystemTool extends BaseTool {
  constructor() {
    super(
      'file_read',
      'Reads contents from local workspace or uploaded document files.',
      {
        type: 'OBJECT',
        properties: {
          filePath: { type: 'STRING', description: 'Relative path of the file to inspect' }
        },
        required: ['filePath']
      }
    );
  }

  async execute(args) {
    return {
      status: 'not_implemented',
      message: `File reading for "${args.filePath}" is not implemented yet.`
    };
  }
}

export const fileSystemTool = new FileSystemTool();
