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

async function launchApplication(userDataDir) {
  const electronApp = await electron.launch({
    args: ['.'],
    cwd: projectRoot,
    env: {
      ...process.env,
      CODING_PLAN_USAGE_TRACKER_E2E: '1',
      CODING_PLAN_USAGE_TRACKER_FIXTURE_ZHIPU: '1',
      CODING_PLAN_USAGE_TRACKER_USER_DATA_DIR: userDataDir
    }
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
  const settingsWindowPromise = electronApp.waitForEvent('window', {
    timeout: 3_000
  }).catch(() => null)

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

async function addProvider(settingsWindow, providerKind) {
  await settingsWindow.getByRole('button', { name: '添加厂商' }).click()

  const modal = settingsWindow.locator('.settings-panel__modal').last()
  await modal.waitFor({ state: 'visible' })

  if (providerKind === 'zhipu') {
    await modal.getByPlaceholder('输入智谱 API Token (sk-...)').fill('sk-stage5-1-fixture')
  } else {
    await modal.getByPlaceholder('从浏览器复制百炼控制台的 Cookie').fill('cookie-stage5-1-fixture')
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
  await electronApp.evaluate(() => {
    globalThis.__CPUT_E2E__.closeMainWindow()
  })

  await waitFor(async () => {
    const runtimeState = await getRuntimeState(electronApp)
    assert.equal(runtimeState.mainWindowVisible, false)
    assert.equal(runtimeState.hasTray, true)
    return runtimeState
  })
}

async function toggleDimension(mainWindow, providerId, dimensionId) {
  await waitFor(async () => {
    const hasDebugApi = await mainWindow.evaluate(
      () => typeof window.__CPUT_RENDERER_DEBUG__?.toggleDimension === 'function'
    )

    assert.equal(hasDebugApi, true)
    return true
  })

  await mainWindow.evaluate(
    ({ nextProviderId, nextDimensionId }) => {
      window.__CPUT_RENDERER_DEBUG__.toggleDimension(nextProviderId, nextDimensionId)
    },
    {
      nextProviderId: providerId,
      nextDimensionId: dimensionId
    }
  )
}

async function run() {
  const userDataDir = await mkdtemp(resolve(tmpdir(), 'coding-plan-usage-tracker-stage5-1-'))
  let electronApp

  try {
    ;({ electronApp } = await launchApplication(userDataDir))
    let mainWindow = await findWindowByTitle(electronApp, APP_TITLE)
    const appProcess = electronApp.process()

    await mainWindow.getByText('请配置厂商').waitFor({ state: 'visible' })

    let settingsWindow = await openSettingsWindow(electronApp)
    await addProvider(settingsWindow, 'zhipu')

    await waitFor(async () => {
      await mainWindow.getByRole('button', { name: /展开 智谱 详情/ }).waitFor({ state: 'visible' })
      await mainWindow.getByText('31%').waitFor({ state: 'visible' })
      return true
    })

    await mainWindow.bringToFront()
    await expandMainWindow(mainWindow)
    await mainWindow.getByText('MCP 每月额度').waitFor({ state: 'visible' })

    await toggleDimension(mainWindow, 'zhipu', 'mcp_monthly')
    await waitFor(async () => {
      const runtimeState = await getRuntimeState(electronApp)
      assert.deepEqual(
        runtimeState.config.providers.find((provider) => provider.providerId === 'zhipu')
          ?.checkedDimensions,
        ['token_5h', 'mcp_monthly']
      )
      return runtimeState
    })

    await toggleDimension(mainWindow, 'zhipu', 'token_5h')
    await waitFor(async () => {
      const runtimeState = await getRuntimeState(electronApp)
      assert.deepEqual(
        runtimeState.config.providers.find((provider) => provider.providerId === 'zhipu')
          ?.checkedDimensions,
        ['mcp_monthly']
      )
      return runtimeState
    })

    await collapseMainWindow(mainWindow)
    await mainWindow.getByText('12%').waitFor({ state: 'visible' })

    const runtimeBeforeDrag = await getRuntimeState(electronApp)
    const movedWindowPosition = { x: 240, y: 180 }
    await mainWindow.evaluate((nextPosition) => {
      window.electronAPI.setWindowPosition(nextPosition)
    }, movedWindowPosition)

    await waitFor(async () => {
      const runtimeState = await getRuntimeState(electronApp)
      assert.equal(runtimeState.config.windowState, 'normal')
      assert.notEqual(runtimeState.config.windowPosition.x, runtimeBeforeDrag.config.windowPosition.x)
      return runtimeState
    })

    await mainWindow.evaluate(() => {
      window.__CPUT_RENDERER_DEBUG__.updateConfig({ windowState: 'docked-right' })
      window.electronAPI.setWindowState('docked-right')
    })

    await waitFor(async () => {
      const runtimeState = await getRuntimeState(electronApp)
      assert.equal(runtimeState.config.windowState, 'docked-right')
      return runtimeState
    })

    await mainWindow.evaluate((restoredPosition) => {
      window.__CPUT_RENDERER_DEBUG__.updateConfig({
        windowState: 'normal',
        windowPosition: restoredPosition
      })
      window.electronAPI.setWindowPosition(restoredPosition)
      window.electronAPI.setWindowState('normal')
    }, movedWindowPosition)
    await waitFor(async () => {
      const runtimeState = await getRuntimeState(electronApp)
      assert.equal(runtimeState.config.windowState, 'normal')
      return runtimeState
    })

    settingsWindow = await openSettingsWindow(electronApp)
    await addProvider(settingsWindow, 'bailian')
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
      assert.deepEqual(runtimeState.config.windowPosition, persistedRuntimeState.config.windowPosition)
      return runtimeState
    })

    await mainWindow.getByText('12%').waitFor({ state: 'visible' })
    await mainWindow.getByText('百炼').waitFor({ state: 'visible' })

    console.log(
      JSON.stringify(
        {
          stage: '5.1',
          status: 'passed',
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
