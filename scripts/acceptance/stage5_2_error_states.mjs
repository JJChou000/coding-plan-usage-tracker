import assert from 'node:assert/strict'
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

async function removeDirectoryWithRetries(targetPath, retries = 8) {
  let lastError

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      await rm(targetPath, { recursive: true, force: true })
      return
    } catch (error) {
      lastError = error
      await sleep(500)
    }
  }

  throw lastError
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

async function setFixtureMode(electronApp, mode) {
  let nextRuntimeState

  switch (mode) {
    case 'auth-error':
      nextRuntimeState = await electronApp.evaluate(() => {
        globalThis.__CPUT_E2E__.setZhipuFixtureMode('auth-error')
        return globalThis.__CPUT_E2E__.getRuntimeState()
      })
      break
    case 'offline':
      nextRuntimeState = await electronApp.evaluate(() => {
        globalThis.__CPUT_E2E__.setZhipuFixtureMode('offline')
        return globalThis.__CPUT_E2E__.getRuntimeState()
      })
      break
    case 'malformed':
      nextRuntimeState = await electronApp.evaluate(() => {
        globalThis.__CPUT_E2E__.setZhipuFixtureMode('malformed')
        return globalThis.__CPUT_E2E__.getRuntimeState()
      })
      break
    case 'success':
    default:
      nextRuntimeState = await electronApp.evaluate(() => {
        globalThis.__CPUT_E2E__.setZhipuFixtureMode('success')
        return globalThis.__CPUT_E2E__.getRuntimeState()
      })
      break
  }

  assert.equal(nextRuntimeState.zhipuFixtureMode, mode)
}

async function refreshFromTray(electronApp) {
  await electronApp.evaluate(() => {
    globalThis.__CPUT_E2E__.refreshFromTray()
  })
}

async function launchApplication(userDataDir, fixtureMode = 'success') {
  const electronApp = await electron.launch({
    args: ['.'],
    cwd: projectRoot,
    env: {
      ...process.env,
      CODING_PLAN_USAGE_TRACKER_E2E: '1',
      CODING_PLAN_USAGE_TRACKER_FIXTURE_ZHIPU: '1',
      CODING_PLAN_USAGE_TRACKER_FIXTURE_ZHIPU_MODE: fixtureMode,
      CODING_PLAN_USAGE_TRACKER_USER_DATA_DIR: userDataDir
    }
  })

  const mainWindow = await electronApp.firstWindow()
  await mainWindow.waitForLoadState('domcontentloaded')

  await waitFor(async () => {
    const runtimeState = await getRuntimeState(electronApp)
    assert.equal(runtimeState.hasTray, true)
    assert.equal(runtimeState.zhipuFixtureMode, fixtureMode)
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

async function addZhipuProvider(settingsWindow) {
  await settingsWindow.getByRole('button', { name: '添加厂商' }).click()

  const modal = settingsWindow.locator('.settings-panel__modal').last()
  await modal.waitFor({ state: 'visible' })
  await modal.getByPlaceholder('输入智谱 API Token (sk-...)').fill('sk-stage5-2-fixture')
  await modal.getByRole('button', { name: '保存' }).click()
  await modal.waitFor({ state: 'hidden' })
}

async function assertInvalidTokenState(mainWindow, settingsWindow, electronApp) {
  await waitFor(async () => {
    const placeholderCount = await mainWindow.locator('.floating-window__placeholder--error').count()
    const placeholderText = await mainWindow.locator('.floating-window__surface').textContent()

    assert.equal(placeholderCount, 1)
    assert.match(placeholderText ?? '', /额度刷新失败/)
    assert.match(placeholderText ?? '', /认证失败/)
    return true
  })

  await waitFor(async () => {
    const settingsErrorText = await settingsWindow.locator('.settings-panel__error').textContent()

    assert.match(settingsErrorText ?? '', /认证失败/)
    return true
  })

  const runtimeState = await getRuntimeState(electronApp)
  assert.equal(runtimeState.mainWindowVisible, true)

  const rendererState = await getRendererState(mainWindow)
  const zhipuUsage = rendererState.usageData.find((item) => item.providerId === 'zhipu')

  assert.equal(zhipuUsage?.dimensions.length, 0)
  assert.match(zhipuUsage?.error ?? '', /认证失败/)
}

async function assertSuccessState(mainWindow) {
  await waitFor(async () => {
    const rowCount = await mainWindow.locator('.collapsed-view__row').count()
    const textContent = await mainWindow.locator('.floating-window__surface').textContent()

    assert.equal(rowCount > 0, true)
    assert.match(textContent ?? '', /31%/)
    return true
  })
}

async function assertErrorBadgeState(mainWindow, expectedErrorPattern) {
  await waitFor(async () => {
    const badgeCount = await mainWindow.locator('.collapsed-view__status--error').count()
    const textContent = await mainWindow.locator('.floating-window__surface').textContent()

    assert.equal(badgeCount > 0, true)
    assert.match(textContent ?? '', /31%/)
    return true
  })

  await mainWindow.evaluate(() => {
    window.__CPUT_RENDERER_DEBUG__.toggleExpand()
  })

  await waitFor(async () => {
    const expandedBadgeCount = await mainWindow.locator('.expanded-view__status--error').count()

    assert.equal(expandedBadgeCount > 0, true)
    return true
  })

  const rendererState = await getRendererState(mainWindow)
  const zhipuUsage = rendererState.usageData.find((item) => item.providerId === 'zhipu')

  assert.equal((zhipuUsage?.dimensions.length ?? 0) > 0, true)
  assert.match(zhipuUsage?.error ?? '', expectedErrorPattern)

  await mainWindow.evaluate(() => {
    window.__CPUT_RENDERER_DEBUG__.toggleExpand()
  })

  await waitFor(async () => {
    const collapsedBadgeCount = await mainWindow.locator('.collapsed-view__status--error').count()

    assert.equal(collapsedBadgeCount > 0, true)
    return true
  })
}

async function run() {
  const userDataDir = await mkdtemp(resolve(tmpdir(), 'coding-plan-usage-tracker-stage5-2-'))
  let electronApp

  try {
    ;({ electronApp } = await launchApplication(userDataDir, 'auth-error'))
    const mainWindow = await findWindowByTitle(electronApp, APP_TITLE)

    await mainWindow.getByText('请配置厂商').waitFor({ state: 'visible' })

    const settingsWindow = await openSettingsWindow(electronApp)
    await addZhipuProvider(settingsWindow)
    await assertInvalidTokenState(mainWindow, settingsWindow, electronApp)

    await setFixtureMode(electronApp, 'success')
    await refreshFromTray(electronApp)
    await assertSuccessState(mainWindow)

    await setFixtureMode(electronApp, 'offline')
    await refreshFromTray(electronApp)
    await assertErrorBadgeState(mainWindow, /网络连接/)

    await setFixtureMode(electronApp, 'success')
    await refreshFromTray(electronApp)
    await waitFor(async () => {
      const textContent = await mainWindow.locator('.floating-window__surface').textContent()

      assert.match(textContent ?? '', /31%/)
      assert.equal(await mainWindow.locator('.collapsed-view__status--error').count(), 0)
      return true
    })

    await setFixtureMode(electronApp, 'malformed')
    await refreshFromTray(electronApp)
    await assertErrorBadgeState(mainWindow, /数据格式不正确/)

    console.log(
      JSON.stringify(
        {
          stage: '5.2',
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

    await sleep(1_000)
    await removeDirectoryWithRetries(userDataDir)
  }
}

await run()
