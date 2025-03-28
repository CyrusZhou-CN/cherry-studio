import os from 'node:os'
import path from 'node:path'

import { getBinaryName, getBinaryPath } from '@main/utils/process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { MCPServer } from '@types'
import { app } from 'electron'
import Logger from 'electron-log'

class McpService {
  private clients: Map<string, Client> = new Map()

  private getServerKey(server: MCPServer): string {
    return JSON.stringify({
      baseUrl: server.baseUrl,
      command: server.command,
      args: server.args,
      env: server.env,
      id: server.id
    })
  }

  constructor() {
    this.initClient = this.initClient.bind(this)
    this.listTools = this.listTools.bind(this)
    this.callTool = this.callTool.bind(this)
    this.closeClient = this.closeClient.bind(this)
    this.removeServer = this.removeServer.bind(this)
  }

  async initClient(server: MCPServer): Promise<Client> {
    const serverKey = this.getServerKey(server)

    // Check if we already have a client for this server configuration
    const existingClient = this.clients.get(serverKey)
    if (existingClient) {
      return existingClient
    }

    // Create new client instance for each connection
    const client = new Client({ name: 'Cherry Studio', version: app.getVersion() }, { capabilities: {} })

    const args = [...(server.args || [])]

    let transport: StdioClientTransport | SSEClientTransport

    try {
      // Create appropriate transport based on configuration
      if (server.baseUrl) {
        transport = new SSEClientTransport(new URL(server.baseUrl))
      } else if (server.command) {
        let cmd = server.command

        if (server.command === 'npx') {
          cmd = await getBinaryPath('bun')

          if (cmd === 'bun') {
            cmd = 'npx'
          }

          Logger.info(`[MCP] Using command: ${cmd}`)

          // add -x to args if args exist
          if (args && args.length > 0) {
            if (!args.includes('-y')) {
              !args.includes('-y') && args.unshift('-y')
            }
            if (cmd.includes('bun') && !args.includes('x')) {
              args.unshift('x')
            }
          }
        }

        if (server.command === 'uvx') {
          cmd = await getBinaryPath('uvx')
        }

        Logger.info(`[MCP] Starting server with command: ${cmd} ${args ? args.join(' ') : ''}`)

        transport = new StdioClientTransport({
          command: cmd,
          args,
          env: server.env
        })
      } else {
        throw new Error('Either baseUrl or command must be provided')
      }

      await client.connect(transport)

      // Store the new client in the cache
      this.clients.set(serverKey, client)

      Logger.info(`[MCP] Activated server: ${server.name}`)
      return client
    } catch (error: any) {
      Logger.error(`[MCP] Error activating server ${server.name}:`, error)
      throw error
    }
  }

  async closeClient(client: Client) {
    if (client) {
      // Remove the client from the cache
      for (const [key, cachedClient] of this.clients.entries()) {
        if (cachedClient === client) {
          this.clients.delete(key)
          break
        }
      }

      await client.close()
    }
  }

  async removeServer(_: Electron.IpcMainInvokeEvent, server: MCPServer) {
    const client = await this.initClient(server)
    await this.closeClient(client)
  }

  async listTools(_: Electron.IpcMainInvokeEvent, server: MCPServer) {
    const client = await this.initClient(server)
    const { tools } = await client.listTools()
    return tools.map((tool) => ({
      ...tool,
      serverId: server.id,
      serverName: server.name
    }))
  }

  /**
   * Call a tool on an MCP server
   */
  public async callTool(
    _: Electron.IpcMainInvokeEvent,
    { server, name, args }: { server: MCPServer; name: string; args: any }
  ): Promise<any> {
    try {
      Logger.info('[MCP] Calling:', server.name, name, args)
      const client = await this.initClient(server)
      const result = await client.callTool({ name, arguments: args })
      return result
    } catch (error) {
      Logger.error(`[MCP] Error calling tool ${name} on ${server.name}:`, error)
      throw error
    }
  }

  public async getInstallInfo() {
    const dir = path.join(os.homedir(), '.cherrystudio', 'bin')
    const uvName = await getBinaryName('uv')
    const bunName = await getBinaryName('bun')
    const uvPath = path.join(dir, uvName)
    const bunPath = path.join(dir, bunName)
    return { dir, uvPath, bunPath }
  }
}

export default new McpService()
