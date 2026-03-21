import { request as httpsRequest } from 'node:https'

import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent, type Tray } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'

import { getConfig, setConfig } from './configStore'
import { createTray } from './tray'
import { createFloatingWindow, resizeWindow, setupEdgeDocking, setupWindowDrag } from './window'
import type { AppConfig } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let appTray: Tray | null = null
let isQuitting = false
let appHandlersRegistered = false
let resizeListenerRegistered = false

const REQUEST_TIMEOUT_MS = 30_000
const ZHIPU_DOMAIN = 'https://open.bigmodel.cn'

type UsageFetchAuthConfig = Record<string, string>

type UsageFetchResponse =
  | {
      providerId: 'zhipu'
      quotaLimit: unknown
      modelUsage: unknown
      toolUsage: unknown
    }
  | {
      providerId: 'bailian'
      data: null
    }
  | {
      error: string
    }

class HttpRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly responseBody: string
  ) {
    super(message)
    this.name = 'HttpRequestError'
  }
}

class RequestTimeoutError extends Error {
  constructor(message = 'Request timed out.') {
    super(message)
    this.name = 'RequestTimeoutError'
  }
}

function isConfigPatch(value: unknown): value is Partial<AppConfig> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isUsageFetchAuthConfig(value: unknown): value is UsageFetchAuthConfig {
  if (!isRecord(value)) {
    return false
  }

  return Object.values(value).every((item) => typeof item === 'string')
}

function formatDateTime(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function buildZhipuUsageUrls(domain: string): {
  quotaLimit: string
  modelUsage: string
  toolUsage: string
} {
  const endTime = new Date()
  const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000)
  const timeQuery = `startTime=${encodeURIComponent(formatDateTime(startTime))}&endTime=${encodeURIComponent(formatDateTime(endTime))}`

  return {
    quotaLimit: `${domain}/api/monitor/usage/quota/limit`,
    modelUsage: `${domain}/api/monitor/usage/model-usage?${timeQuery}`,
    toolUsage: `${domain}/api/monitor/usage/tool-usage?${timeQuery}`
  }
}

function extractErrorMessageFromBody(responseBody: string): string | undefined {
  const trimmedBody = responseBody.trim()

  if (!trimmedBody) {
    return undefined
  }

  try {
    const parsedBody = JSON.parse(trimmedBody) as unknown

    if (typeof parsedBody === 'string') {
      return parsedBody
    }

    if (!isRecord(parsedBody)) {
      return undefined
    }

    const directKeys = ['error', 'message', 'msg']

    for (const key of directKeys) {
      const value = parsedBody[key]

      if (typeof value === 'string' && value.trim().length > 0) {
        return value
      }
    }

    if (isRecord(parsedBody.data)) {
      for (const key of directKeys) {
        const value = parsedBody.data[key]

        if (typeof value === 'string' && value.trim().length > 0) {
          return value
        }
      }
    }
  } catch {
    return trimmedBody.split(/\r?\n/u)[0]?.trim() || undefined
  }

  return undefined
}

function getApiErrorStatusCode(payload: Record<string, unknown>): number | null {
  const code = payload.code

  if (typeof code === 'number' && Number.isFinite(code)) {
    return code
  }

  if (typeof code === 'string' && code.trim().length > 0) {
    const parsedCode = Number(code)

    return Number.isFinite(parsedCode) ? parsedCode : null
  }

  return null
}

function getLogicalApiError(payload: unknown): { statusCode: number } | null {
  if (!isRecord(payload)) {
    return null
  }

  const statusCode = getApiErrorStatusCode(payload)
  const success = payload.success

  if (success === false && statusCode !== null) {
    return { statusCode }
  }

  if (statusCode !== null && statusCode >= 400) {
    return { statusCode }
  }

  return null
}

function createRequestHeaders(authToken: string): Record<string, string> {
  return {
    Authorization: authToken,
    Accept: 'application/json',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Content-Type': 'application/json'
  }
}

function requestJson(url: string, authToken: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const request = httpsRequest(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port ? Number(parsedUrl.port) : undefined,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: 'GET',
        headers: createRequestHeaders(authToken)
      },
      (response) => {
        let responseBody = ''

        response.setEncoding('utf8')
        response.on('data', (chunk) => {
          responseBody += chunk
        })
        response.on('end', () => {
          const statusCode = response.statusCode ?? 0

          if (statusCode < 200 || statusCode >= 300) {
            reject(new HttpRequestError(`HTTP ${statusCode}`, statusCode, responseBody))
            return
          }

          if (!responseBody.trim()) {
            resolve(null)
            return
          }

          try {
            const parsedBody = JSON.parse(responseBody) as unknown
            const logicalApiError = getLogicalApiError(parsedBody)

            if (logicalApiError) {
              reject(
                new HttpRequestError(
                  `HTTP ${logicalApiError.statusCode}`,
                  logicalApiError.statusCode,
                  responseBody
                )
              )
              return
            }

            resolve(parsedBody)
          } catch {
            reject(new Error('接口返回了非 JSON 响应。'))
          }
        })
      }
    )

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new RequestTimeoutError(`Request timed out after ${REQUEST_TIMEOUT_MS}ms.`))
    })
    request.on('error', reject)
    request.end()
  })
}

function getProviderLabel(providerId: string): string {
  switch (providerId) {
    case 'zhipu':
      return '智谱'
    case 'bailian':
      return '百炼'
    default:
      return providerId
  }
}

function formatUsageFetchError(providerId: string, error: unknown): string {
  const providerLabel = getProviderLabel(providerId)

  if (error instanceof RequestTimeoutError) {
    return `${providerLabel} API 请求超时（30s）。`
  }

  if (error instanceof HttpRequestError) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return `${providerLabel} 认证失败，请检查 Token。`
    }

    const detail = extractErrorMessageFromBody(error.responseBody)

    return detail
      ? `${providerLabel} API 请求失败（HTTP ${error.statusCode}）：${detail}`
      : `${providerLabel} API 请求失败（HTTP ${error.statusCode}）。`
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return `${providerLabel} API 请求失败：${error.message}`
  }

  return `${providerLabel} API 请求失败。`
}

async function fetchZhipuUsage(authConfig: UsageFetchAuthConfig): Promise<UsageFetchResponse> {
  const authToken = authConfig.authToken?.trim() ?? ''

  if (!authToken) {
    return {
      error: '缺少智谱 API Token。'
    }
  }

  const urls = buildZhipuUsageUrls(ZHIPU_DOMAIN)

  try {
    const [quotaLimit, modelUsage, toolUsage] = await Promise.all([
      requestJson(urls.quotaLimit, authToken),
      requestJson(urls.modelUsage, authToken),
      requestJson(urls.toolUsage, authToken)
    ])

    return {
      providerId: 'zhipu',
      quotaLimit,
      modelUsage,
      toolUsage
    }
  } catch (error) {
    return {
      error: formatUsageFetchError('zhipu', error)
    }
  }
}

async function handleUsageFetch(
  _event: IpcMainInvokeEvent,
  providerId: unknown,
  authConfig: unknown
): Promise<UsageFetchResponse> {
  const resolvedProviderId = typeof providerId === 'string' ? providerId.trim() : ''
  const resolvedAuthConfig = isUsageFetchAuthConfig(authConfig) ? authConfig : {}

  if (!resolvedProviderId) {
    return {
      error: '缺少 providerId。'
    }
  }

  switch (resolvedProviderId) {
    case 'zhipu':
      return fetchZhipuUsage(resolvedAuthConfig)
    case 'bailian':
      return {
        providerId: 'bailian',
        data: null
      }
    default:
      return {
        error: `未支持的 Provider：${resolvedProviderId}`
      }
  }
}

function broadcastConfigUpdate(config: AppConfig): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) {
      continue
    }

    window.webContents.send('config:updated', config)
  }
}

function registerAppIpcHandlers(): void {
  if (appHandlersRegistered) {
    return
  }

  ipcMain.handle('config:get', () => getConfig())
  ipcMain.handle('config:set', (_event, configPatch) => {
    if (isConfigPatch(configPatch)) {
      setConfig(configPatch)
      broadcastConfigUpdate(getConfig())
    }
  })
  ipcMain.handle('usage:fetch', handleUsageFetch)

  appHandlersRegistered = true
}

function bindWindowIpc(): void {
  if (resizeListenerRegistered) {
    return
  }

  ipcMain.on('window:resize', (_event, width, height) => {
    if (
      !mainWindow ||
      mainWindow.isDestroyed() ||
      typeof width !== 'number' ||
      typeof height !== 'number'
    ) {
      return
    }

    resizeWindow(mainWindow, width, height)
  })

  resizeListenerRegistered = true
}

function bootstrapFloatingWindow(): BrowserWindow {
  const win = createFloatingWindow()

  mainWindow = win
  win.on('close', (event) => {
    if (isQuitting) {
      return
    }

    event.preventDefault()
    win.hide()
  })
  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null
    }
  })
  setupWindowDrag(win)
  setupEdgeDocking(win)
  bindWindowIpc()

  return win
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.codingplanusagetracker.app')
  registerAppIpcHandlers()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  bootstrapFloatingWindow()
  appTray = createTray(() => mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      bootstrapFloatingWindow()
    }

    if (!appTray) {
      appTray = createTray(() => mainWindow)
    }
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  // Keep the app alive so the tray can control reopening and exiting.
})
