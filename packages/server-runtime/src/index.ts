import type { WebSocketEvent } from '@proj-airi/server-shared/types'

import type { AuthenticatedPeer, Peer } from './types'

import { argv, env } from 'node:process'

import { Format, LogLevel, setGlobalFormat, setGlobalLogLevel, useLogg } from '@guiiai/logg'
import { plugin as ws } from 'crossws/server'
import { defineWebSocketHandler, H3, serve } from 'h3'

setGlobalFormat(Format.Pretty)
setGlobalLogLevel(LogLevel.Log)

// cache token once
const AUTH_TOKEN = env.AUTHENTICATION_TOKEN || ''

// pre-stringified responses
const RESPONSES = {
  authenticated: JSON.stringify({ type: 'module:authenticated', data: { authenticated: true } }),
  notAuthenticated: JSON.stringify({ type: 'error', data: { message: 'not authenticated' } }),
}

// helper send function
function send(peer: Peer, event: WebSocketEvent<Record<string, unknown>> | string) {
  peer.send(typeof event === 'string' ? event : JSON.stringify(event))
}

function main() {
  console.info('[DEBUG] main() function called')
  const appLogger = useLogg('App').useGlobalConfig()
  const websocketLogger = useLogg('WebSocket').useGlobalConfig()
  console.info('[DEBUG] Loggers initialized')

  const app = new H3({
    onError: (error) => {
      console.error('[DEBUG] H3 onError:', error)
      appLogger.withError(error).error('an error occurred')
    },
  })
  console.info('[DEBUG] H3 app created')

  const peers = new Map<string, AuthenticatedPeer>()
  const peersByModule = new Map<string, Map<number | undefined, AuthenticatedPeer>>()

  function registerModulePeer(p: AuthenticatedPeer, name: string, index?: number) {
    if (!peersByModule.has(name)) {
      peersByModule.set(name, new Map())
    }
    const group = peersByModule.get(name)!
    if (group.has(index)) {
      // log instead of silent overwrite
      websocketLogger.withFields({ name, index }).debug('peer replaced for module')
    }
    group.set(index, p)
  }

  function unregisterModulePeer(p: AuthenticatedPeer) {
    if (!p.name)
      return
    const group = peersByModule.get(p.name)
    if (group) {
      group.delete(p.index)
      if (group.size === 0) {
        peersByModule.delete(p.name)
      }
    }
  }

  // Test endpoint
  app.get('/test', () => ({ message: 'AIRI Server is running', timestamp: new Date().toISOString() }))

  app.get('/ws', defineWebSocketHandler({
    open: (peer) => {
      console.info('[DEBUG] WebSocket connection opened:', { peerId: peer.id })

      if (AUTH_TOKEN) {
        peers.set(peer.id, { peer, authenticated: false, name: '' })
      }
      else {
        peer.send(RESPONSES.authenticated)
        peers.set(peer.id, { peer, authenticated: true, name: '' })
      }

      console.info('[DEBUG] Peer registered:', { peerId: peer.id, authenticated: !AUTH_TOKEN, totalPeers: peers.size })
      websocketLogger.withFields({ peer: peer.id, activePeers: peers.size }).log('connected')
    },
    message: (peer, message) => {
      let event: WebSocketEvent
      try {
        event = message.json() as WebSocketEvent
      }
      catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        send(peer, { type: 'error', data: { message: `invalid JSON, error: ${errorMessage}` } })
        return
      }

      // DEBUG: Log all received messages
      console.info('[DEBUG] Received message:', { peer: peer.id, eventType: event.type })
      websocketLogger.withFields({ peer: peer.id, eventType: event.type }).log('received message')

      switch (event.type) {
        case 'module:authenticate': {
          if (AUTH_TOKEN && event.data.token !== AUTH_TOKEN) {
            websocketLogger.withFields({ peer: peer.id }).debug('authentication failed')
            send(peer, { type: 'error', data: { message: 'invalid token' } })
            return
          }

          peer.send(RESPONSES.authenticated)
          const p = peers.get(peer.id)
          if (p) {
            Object.assign(p, { authenticated: true })
          }
          return
        }
        case 'module:announce': {
          const p = peers.get(peer.id)
          if (p) {
            unregisterModulePeer(p)
            const { name, index } = event.data as { name: string, index?: number }
            if (!name || typeof name !== 'string') {
              send(peer, { type: 'error', data: { message: 'the field \'name\' must be a non-empty string for event \'module:announce\'' } })
              return
            }
            if (typeof index !== 'undefined') {
              if (!Number.isInteger(index) || index < 0) {
                send(peer, { type: 'error', data: { message: 'the field \'index\' must be a non-negative integer for event \'module:announce\'' } })
                return
              }
            }
            if (AUTH_TOKEN && !p.authenticated) {
              send(peer, { type: 'error', data: { message: 'must authenticate before announcing' } })
              return
            }
            Object.assign(p, { name, index })
            registerModulePeer(p, p.name, p.index)

            // Send acknowledgment to client
            send(peer, { type: 'module:announced', data: { name, index } })
            websocketLogger.withFields({ peer: peer.id, name, index }).log('module announced')
          }
          return
        }

        case 'ui:configure': {
          const { moduleName, moduleIndex, config } = event.data

          if (moduleName === '') {
            send(peer, { type: 'error', data: { message: 'the field \'moduleName\' can\'t be empty for event \'ui:configure\'' } })
            return
          }
          if (typeof moduleIndex !== 'undefined') {
            if (!Number.isInteger(moduleIndex) || moduleIndex < 0) {
              send(peer, {
                type: 'error',
                data: { message: 'the field \'moduleIndex\' must be a non-negative integer for event \'ui:configure\'' },
              })
              return
            }
          }

          const target = peersByModule.get(moduleName)?.get(moduleIndex)
          if (target) {
            send(target.peer, { type: 'module:configure', data: { config } })
          }
          else {
            send(peer, { type: 'error', data: { message: 'module not found, it hasn\'t announced itself or the name is incorrect' } })
          }
          return
        }
      }

      // default case
      const p = peers.get(peer.id)
      // DEBUG: Log authentication status
      websocketLogger.withFields({
        peer: peer.id,
        authenticated: p?.authenticated,
        peerExists: !!p,
        eventType: event.type,
      }).log('default case - auth check')

      if (!p?.authenticated) {
        websocketLogger.withFields({ peer: peer.id }).debug('not authenticated')
        peer.send(RESPONSES.notAuthenticated)
        return
      }

      const payload = JSON.stringify(event)
      // DEBUG: Log broadcast
      websocketLogger.withFields({
        peer: peer.id,
        totalPeers: peers.size,
        eventType: event.type,
      }).log('broadcasting to peers')

      for (const [id, other] of peers.entries()) {
        if (id === peer.id) {
          console.info(`[DEBUG] Skipping sender peer ${id}`)
          continue
        }

        // Skip readyState check and always try to send
        // crossws doesn't reliably provide readyState
        try {
          websocketLogger.withFields({
            from: peer.id,
            to: id,
            eventType: event.type,
          }).log('sending to peer')
          other.peer.send(payload)
          console.info(`[DEBUG] Successfully sent message to peer ${id}`)
        }
        catch (error) {
          console.error(`[DEBUG] Failed to send to peer ${id}, deleting:`, error)
          peers.delete(id)
          unregisterModulePeer(other)
        }
      }
    },
    error: (peer, error) => {
      websocketLogger.withFields({ peer: peer.id }).withError(error).error('an error occurred')
    },
    close: (peer, details) => {
      const p = peers.get(peer.id)
      if (p)
        unregisterModulePeer(p)

      websocketLogger.withFields({ peer: peer.id, details, activePeers: peers.size }).log('closed')
      peers.delete(peer.id)
    },
  }))

  return app
}

// Create single app instance
export const app = main()

// Start server only if this file is run directly (not imported)
if (import.meta.url === `file://${argv[1]}`) {
  const port = Number.parseInt(env.PORT || '6121', 10)

  console.info(`[AIRI Server] Starting server on port ${port}...`)
  serve(app, {
    port,
    plugins: [ws({
      resolve: async req => (await app.fetch(req)).crossws,
    })],
  })
  console.info(`[AIRI Server] Server is ready at http://localhost:${port}`)
}
