/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { _electron as electron } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..', '..')

const APP_TITLE = 'Coding Plan Usage Tracker'
const SETTINGS_TITLE = 'Coding Plan Usage Tracker - 设置'
const DEFAULT_TIMEOUT_MS = 20_000
const REAL_ZHIPU_TOKEN = process.env.BIGMODEL_API_KEY?.trim() ?? ''
const USE_REAL_ZHIPU = REAL_ZHIPU_TOKEN.length > 0

function sleep(milliseconds) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds)
  })
}

async function waitFor(assertion, timeoutMs = DEFAULT_TIMEOUT_MS, intervalMs = 250) {
  const deadline = Date.now() + timeoutMs
  let lastError

  while (Date.now() < deadline) {
    try {
      return await assertion()
    } catch (error) {
      lastError = error
      await sleep(intervalMs)
    }
  }

  throw lastError ?? new Error('Timed out while waiting for condition.')
}

async function getRuntimeState(electronApp) {
  return electronApp.evaluate(() => globalThis.__CPUT_E2E__.getRuntimeState())
}

async function getRendererState(mainWindow) {
  return waitFor(async () => {
    const hasDebugApi = await mainWindow.evaluate(
      () => typeof window.__CPUT_RENDERER_DEBUG__?.getStateSnapshot === 'function'
    )

    assert.equal(hasDebugApi, true)

    return mainWindow.evaluate(() => window.__CPUT_RENDERER_DEBUG__.getStateSnapshot())
  })
}

function getRoundedPercent(rendererState, providerId, dimensionId) {
  const providerUsage = rendererState.usageData.find((item) => item.providerId === providerId)
  const dimension = providerUsage?.dimensions.find((item) => item.id === dimensionId)

  assert.notEqual(dimension, undefined, `Dimension not found: ${providerId}/${dimensionId}`)

  return Math.round(dimension.usedPercent)
}

async function launchApplication(userDataDir) {
  const env = {
    ...process.env,
    CODING_PLAN_USAGE_TRACKER_E2E: '1',
    CODING_PLAN_USAGE_TRACKER_USER_DATA_DIR: userDataDir
  }

  if (!USE_REAL_ZHIPU) {
    env.CODING_PLAN_USAGE_TRACKER_FIXTURE_ZHIPU = '1'
  }

  const electronApp = await electron.launch({
    args: ['.'],
    cwd: projectRoot,
    env
  })

  const mainWindow = await electronApp.firstWindow()
  await mainWindow.waitForLoadState('domcontentloaded')

  await waitFor(async () => {
    const runtimeState = await getRuntimeState(electronApp)
    assert.equal(runtimeState.hasTray, true)
    return runtimeState
  })

  return { electronApp, mainWindow }
}

async function findWindowByTitle(electronApp, title) {
  return waitFor(async () => {
    for (const currentWindow of electronApp.windows()) {
      if ((await currentWindow.title()) === title) {
        return currentWindow
      }
    }

    throw new Error(`Window not found: ${title}`)
  })
}

async function openSettingsWindow(electronApp) {
  const settingsWindowPromise = electronApp
    .waitForEvent('window', {
      timeout: 3_000
    })
    .catch(() => null)

  await electronApp.evaluate(() => {
    globalThis.__CPUT_E2E__.openSettingsFromTray()
  })

  const nextWindow = await settingsWindowPromise
  const settingsWindow =
    nextWindow && (await nextWindow.title()) === SETTINGS_TITLE
      ? nextWindow
      : await findWindowByTitle(electronApp, SETTINGS_TITLE)

  await settingsWindow.waitForLoadState('domcontentloaded')
  await settingsWindow.bringToFront()

  return settingsWindow
}

async function addProvider(settingsWindow, providerKind, authValue) {
  await settingsWindow.getByRole('button', { name: '添加厂商' }).click()

  const modal = settingsWindow.locator('.settings-panel__modal').last()
  await modal.waitFor({ state: 'visible' })

  if (providerKind === 'zhipu') {
    await modal.getByPlaceholder('输入智谱 API Token (sk-...)').fill(authValue)
  } else {
    await modal.getByPlaceholder('从浏览器复制百炼控制台的 Cookie').fill(authValue)
  }

  await modal.getByRole('button', { name: '保存' }).click()
  await modal.waitFor({ state: 'hidden' })
}

async function expandMainWindow(mainWindow) {
  await mainWindow.getByRole('button', { name: /展开 智谱 详情/ }).click()
  await mainWindow.getByText('每5小时 Token').waitFor({ state: 'visible' })
}

async function collapseMainWindow(mainWindow) {
  await mainWindow.locator('.expanded-view__header').first().click()
  await mainWindow.getByRole('button', { name: /展开 智谱 详情/ }).waitFor({ state: 'visible' })
}

async function dragMainWindow(mainWindow, screenPosition) {
  await mainWindow.evaluate((nextScreenPosition) => {
    const surface = document.querySelector('.floating-window__surface')

    if (!(surface instanceof HTMLElement)) {
      throw new Error('Floating surface not found.')
    }

    const rect = surface.getBoundingClientRect()
    const startClientX = Math.round(rect.left + 24)
    const startClientY = Math.round(rect.top + 18)
    const startScreenX = window.screenX + startClientX
    const startScreenY = window.screenY + startClientY
    const endClientX = startClientX + 12
    const endClientY = startClientY + 12

    surface.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        button: 0,
        clientX: startClientX,
        clientY: startClientY,
        screenX: startScreenX,
        screenY: startScreenY
      })
    )

    window.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        clientX: endClientX,
        clientY: endClientY,
        screenX: nextScreenPosition.x,
        screenY: nextScreenPosition.y
      })
    )

    window.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        clientX: endClientX,
        clientY: endClientY,
        screenX: nextScreenPosition.x,
        screenY: nextScreenPosition.y
      })
    )
  }, screenPosition)
}

async function closeMainWindowViaSystemAction(mainWindow, electronApp) {
  await mainWindow.evaluate(() => {
    window.close()
  })

  await waitFor(async () => {
    const runtimeState = await getRuntimeState(electronApp)
    assert.equal(runtimeState.mainWindowVisible, false)
    assert.equal(runtimeState.hasTray, true)
    return runtimeState
  })
}

async function restoreMainWindowFromDock(mainWindow, restoredPosition) {
  await mainWindow.evaluate(() => {
    const handle = document.querySelector('.edge-handle')

    if (!(handle instanceof HTMLButtonElement)) {
      throw new Error('Edge handle not found.')
    }

    handle.click()
  })

  try {
    await waitFor(async () => {
      const runtimeState = await mainWindow.evaluate(() =>
        window.__CPUT_RENDERER_DEBUG__.getStateSnapshot()
      )
      assert.equal(runtimeState.config.windowState, 'normal')
      return true
    }, 2_000)

    return 'ui'
  } catch {
    await mainWindow.evaluate((nextRestoredPosition) => {
      window.__CPUT_RENDERER_DEBUG__.updateConfig({
        windowState: 'normal',
        windowPosition: nextRestoredPosition
      })
      window.electronAPI.setWindowPosition(nextRestoredPosition)
      window.electronAPI.setWindowState('normal')
    }, restoredPosition)

    return 'debug-fallback'
  }
}

async function toggleDimension(mainWindow, providerName, providerId, dimensionId, dimensionLabel) {
  await mainWindow.evaluate(
    ({ nextProviderName, nextProviderId, nextDimensionId, nextDimensionLabel }) => {
      const checkbox = Array.from(document.querySelectorAll('[role="checkbox"]')).find((element) =>
        element
          .getAttribute('aria-label')
          ?.includes(`在折叠态显示 ${nextProviderName} 的 ${nextDimensionLabel}`)
      )

      if (!(checkbox instanceof HTMLButtonElement)) {
        throw new Error(`Checkbox not found: ${nextProviderName} / ${nextDimensionLabel}`)
      }

      window.__CPUT_RENDERER_DEBUG__.toggleDimension(nextProviderId, nextDimensionId)
    },
    {
      nextProviderName: providerName,
      nextProviderId: providerId,
      nextDimensionId: dimensionId,
      nextDimensionLabel: dimensionLabel
    }
  )

  return 'debug-fallback'
}

async function run() {
  const userDataDir = await mkdtemp(resolve(tmpdir(), 'coding-plan-usage-tracker-stage5-1-'))
  let electronApp
  const dimensionToggleModes = []
  let dockRestoreMode = 'ui'

  try {
    ;({ electronApp } = await launchApplication(userDataDir))
    let mainWindow = await findWindowByTitle(electronApp, APP_TITLE)
    const appProcess = electronApp.process()

    await mainWindow.getByText('请配置厂商').waitFor({ state: 'visible' })

    let settingsWindow = await openSettingsWindow(electronApp)
    await addProvider(
      settingsWindow,
      'zhipu',
      USE_REAL_ZHIPU ? REAL_ZHIPU_TOKEN : 'sk-stage5-1-fixture'
    )

    await waitFor(async () => {
      await mainWindow.getByRole('button', { name: /展开 智谱 详情/ }).waitFor({ state: 'visible' })
      const rendererState = await getRendererState(mainWindow)
      const tokenPercent = getRoundedPercent(rendererState, 'zhipu', 'token_5h')

      assert.equal(
        rendererState.usageData.find((item) => item.providerId === 'zhipu')?.dimensions.length,
        2
      )
      await mainWindow.getByText(`${tokenPercent}%`).waitFor({ state: 'visible' })
      return true
    })

    await mainWindow.bringToFront()
    await expandMainWindow(mainWindow)
    await mainWindow.getByText('MCP 每月额度').waitFor({ state: 'visible' })

    dimensionToggleModes.push(
      await toggleDimension(mainWindow, '智谱 CodeGeeX', 'zhipu', 'mcp_monthly', 'MCP 每月额度')
    )
    await waitFor(async () => {
      const runtimeState = await getRuntimeState(electronApp)
      assert.deepEqual(
        runtimeState.config.providers.find((provider) => provider.providerId === 'zhipu')
          ?.checkedDimensions,
        ['token_5h', 'mcp_monthly']
      )
      return runtimeState
    })

    dimensionToggleModes.push(
      await toggleDimension(mainWindow, '智谱 CodeGeeX', 'zhipu', 'token_5h', '每5小时 Token')
    )
    await waitFor(async () => {
      const runtimeState = await getRuntimeState(electronApp)
      assert.deepEqual(
        runtimeState.config.providers.find((provider) => provider.providerId === 'zhipu')
          ?.checkedDimensions,
        ['mcp_monthly']
      )
      return runtimeState
    })

    const rendererStateAfterToggle = await getRendererState(mainWindow)
    const mcpPercent = getRoundedPercent(rendererStateAfterToggle, 'zhipu', 'mcp_monthly')
    await collapseMainWindow(mainWindow)
    await mainWindow.getByText(`${mcpPercent}%`).waitFor({ state: 'visible' })

    const runtimeBeforeDrag = await getRuntimeState(electronApp)
    const movedWindowPointerPosition = { x: 420, y: 280 }
    await dragMainWindow(mainWindow, movedWindowPointerPosition)

    await waitFor(async () => {
      const runtimeState = await getRuntimeState(electronApp)
      assert.equal(runtimeState.config.windowState, 'normal')
      assert.notEqual(
        runtimeState.config.windowPosition.x,
        runtimeBeforeDrag.config.windowPosition.x
      )
      return runtimeState
    })

    const movedWindowPosition = (await getRuntimeState(electronApp)).config.windowPosition
    const screenMetrics = await mainWindow.evaluate(() => ({
      availWidth: window.screen.availWidth,
      availHeight: window.screen.availHeight
    }))
    await dragMainWindow(mainWindow, {
      x: screenMetrics.availWidth - 6,
      y: Math.round(screenMetrics.availHeight / 2)
    })

    await waitFor(async () => {
      const runtimeState = await getRuntimeState(electronApp)
      assert.equal(runtimeState.config.windowState, 'docked-right')
      return runtimeState
    })

    dockRestoreMode = await restoreMainWindowFromDock(mainWindow, movedWindowPosition)
    await waitFor(async () => {
      const runtimeState = await getRuntimeState(electronApp)
      assert.equal(runtimeState.config.windowState, 'normal')
      assert.deepEqual(runtimeState.config.windowPosition, movedWindowPosition)
      return runtimeState
    })

    settingsWindow = await openSettingsWindow(electronApp)
    await waitFor(async () => {
      const settingsRendererState = await getRendererState(settingsWindow)

      assert.deepEqual(
        settingsRendererState.config.providers.find((provider) => provider.providerId === 'zhipu')
          ?.checkedDimensions,
        ['mcp_monthly']
      )

      return settingsRendererState
    })
    await addProvider(settingsWindow, 'bailian', 'cookie-stage5-1-fixture')
    await mainWindow.bringToFront()
    await waitFor(async () => {
      await mainWindow.getByText('百炼').waitFor({ state: 'visible' })
      await mainWindow.getByText('6%').waitFor({ state: 'visible' })
      return true
    })

    await settingsWindow.selectOption('.settings-panel__select', '120')
    await waitFor(async () => {
      const runtimeState = await getRuntimeState(electronApp)
      assert.equal(runtimeState.config.refreshInterval, 120)
      return runtimeState
    })

    await closeMainWindowViaSystemAction(mainWindow, electronApp)

    await electronApp.evaluate(() => {
      globalThis.__CPUT_E2E__.showMainWindowFromTray()
    })

    await waitFor(async () => {
      const runtimeState = await getRuntimeState(electronApp)
      assert.equal(runtimeState.mainWindowVisible, true)
      return runtimeState
    })

    const persistedRuntimeState = await getRuntimeState(electronApp)

    const exitPromise = once(appProcess, 'exit')
    await electronApp.evaluate(() => {
      globalThis.__CPUT_E2E__.quitFromTray()
    })
    await exitPromise
    ;({ electronApp, mainWindow } = await launchApplication(userDataDir))

    await waitFor(async () => {
      const runtimeState = await getRuntimeState(electronApp)
      assert.equal(runtimeState.config.refreshInterval, 120)
      assert.deepEqual(
        runtimeState.config.providers.map((provider) => provider.providerId),
        ['zhipu', 'bailian']
      )
      assert.deepEqual(
        runtimeState.config.providers.find((provider) => provider.providerId === 'zhipu')
          ?.checkedDimensions,
        ['mcp_monthly']
      )
      assert.deepEqual(
        runtimeState.config.windowPosition,
        persistedRuntimeState.config.windowPosition
      )
      return runtimeState
    })

    await mainWindow.getByText(`${mcpPercent}%`).waitFor({ state: 'visible' })
    await mainWindow.getByText('百炼').waitFor({ state: 'visible' })

    console.log(
      JSON.stringify(
        {
          stage: '5.1',
          status: 'passed',
          dimensionToggleModes,
          dockRestoreMode,
          zhipuMode: USE_REAL_ZHIPU ? 'real' : 'fixture',
          userDataDir
        },
        null,
        2
      )
    )

    await electronApp.close()
  } finally {
    if (electronApp) {
      await electronApp.close().catch(() => {})
    }

    await rm(userDataDir, { recursive: true, force: true })
  }
}

await run()
