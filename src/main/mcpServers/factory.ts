import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import Logger from 'electron-log'

import MemoryServer from './memory'

export function createInMemoryMCPServer(name: string, args: string[] = [], envs: Record<string, string> = {}): Server {
  Logger.info(`[MCP] Creating in-memory MCP server: ${name} with args: ${args} and envs: ${JSON.stringify(envs)}`)
  switch (name) {
    case '@cherry/memory': {
      const memoryServer = new MemoryServer(envs)
      return memoryServer.server
    }
    default:
      throw new Error(`Unknown in-memory MCP server: ${name}`)
  }
}
