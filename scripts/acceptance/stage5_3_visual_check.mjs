import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { _electron as electron } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..', '..')
const outputDir = resolve(projectRoot, 'output', 'playwright', 'stage5_3')

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

function parseRgbChannel(rawValue) {
  const parsed = Number(rawValue)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseAlpha(rawValue) {
  if (rawValue === undefined) {
    return 1
  }

  const parsed = Number(rawValue)
  return Number.isFinite(parsed) ? parsed : 1
}

function parseColor(rawColor) {
  const match = rawColor.match(
    /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/i
  )

  if (!match) {
    throw new Error(`Unsupported color format: ${rawColor}`)
  }

  return {
    red: parseRgbChannel(match[1]),
    green: parseRgbChannel(match[2]),
    blue: parseRgbChannel(match[3]),
    alpha: parseAlpha(match[4])
  }
}

function compositeOnBlack(color) {
  return {
    red: color.red * color.alpha,
    green: color.green * color.alpha,
    blue: color.blue * color.alpha
  }
}

function toLinearChannel(channel) {
  const normalized = channel / 255
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

function getRelativeLuminance(color) {
  return (
    0.2126 * toLinearChannel(color.red) +
    0.7152 * toLinearChannel(color.green) +
    0.0722 * toLinearChannel(color.blue)
  )
}

function getContrastRatio(foreground, background) {
  const foregroundLuminance = getRelativeLuminance(foreground)
  const backgroundLuminance = getRelativeLuminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

async function launchApplication(userDataDir) {
  const electronApp = await electron.launch({
    args: ['.'],
    cwd: projectRoot,
    env: {
      ...process.env,
      CODING_PLAN_USAGE_TRACKER_E2E: '1',
      CODING_PLAN_USAGE_TRACKER_FIXTURE_ZHIPU: '1',
      CODING_PLAN_USAGE_TRACKER_FIXTURE_ZHIPU_MODE: 'success',
      CODING_PLAN_USAGE_TRACKER_USER_DATA_DIR: userDataDir
    }
  })

  const mainWindow = await electronApp.firstWindow()
  await mainWindow.waitForLoadState('domcontentloaded')

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
  await settingsWindow.locator('.settings-panel__button--primary').first().click()

  const modal = settingsWindow.locator('.settings-panel__modal').last()
  await modal.waitFor({ state: 'visible' })
  await modal.locator('.settings-panel__input').first().fill('sk-stage5-3-fixture')
  await modal.locator('.settings-panel__button--primary').last().click()
  await modal.waitFor({ state: 'hidden' })
}

async function getFloatingVisualMetrics(mainWindow) {
  return mainWindow.evaluate(() => {
    const floatingWindow = document.querySelector('.floating-window')
    const surface = document.querySelector('.floating-window__surface')
    const primaryText = document.querySelector('.collapsed-view__name')
    const secondaryText = document.querySelector('.collapsed-view__reset')
    const progressFill = document.querySelector('.progress-bar__fill')

    if (
      !(floatingWindow instanceof HTMLElement) ||
      !(surface instanceof HTMLElement) ||
      !(primaryText instanceof HTMLElement) ||
      !(secondaryText instanceof HTMLElement) ||
      !(progressFill instanceof HTMLElement)
    ) {
      throw new Error('Failed to collect floating window metrics.')
    }

    const windowStyle = window.getComputedStyle(floatingWindow)
    const surfaceStyle = window.getComputedStyle(surface)
    const primaryTextStyle = window.getComputedStyle(primaryText)
    const secondaryTextStyle = window.getComputedStyle(secondaryText)
    const progressStyle = window.getComputedStyle(progressFill)
    const bodyStyle = window.getComputedStyle(document.body)

    return {
      fontFamily: bodyStyle.fontFamily,
      surfaceBackgroundColor: surfaceStyle.backgroundColor,
      surfaceBackgroundImage: surfaceStyle.backgroundImage,
      surfaceBackdropFilter: surfaceStyle.backdropFilter || surfaceStyle.webkitBackdropFilter,
      primaryTextColor: primaryTextStyle.color,
      secondaryTextColor: secondaryTextStyle.color,
      windowTransitionProperty: windowStyle.transitionProperty,
      windowTransitionDuration: windowStyle.transitionDuration,
      progressBackgroundImage: progressStyle.backgroundImage,
      progressBoxShadow: progressStyle.boxShadow,
      progressTransitionProperty: progressStyle.transitionProperty
    }
  })
}

async function getSettingsVisualMetrics(settingsWindow) {
  return settingsWindow.evaluate(() => {
    const panel = document.querySelector('.settings-panel')
    const header = document.querySelector('.settings-panel__header')
    const description = document.querySelector('.settings-panel__description')

    if (
      !(panel instanceof HTMLElement) ||
      !(header instanceof HTMLElement) ||
      !(description instanceof HTMLElement)
    ) {
      throw new Error('Failed to collect settings visual metrics.')
    }

    const panelStyle = window.getComputedStyle(panel)
    const headerStyle = window.getComputedStyle(header)
    const descriptionStyle = window.getComputedStyle(description)
    const resolvedLineHeight =
      Number.parseFloat(descriptionStyle.lineHeight) ||
      Number.parseFloat(descriptionStyle.fontSize) * 1.5

    return {
      panelBackgroundColor: panelStyle.backgroundColor,
      panelBackgroundImage: panelStyle.backgroundImage,
      headerBackgroundColor: headerStyle.backgroundColor,
      descriptionColor: descriptionStyle.color,
      descriptionLineHeightPixels: resolvedLineHeight
    }
  })
}

async function getDockedHandleMetrics(mainWindow) {
  return mainWindow.evaluate(() => {
    const handle = document.querySelector('.edge-handle')

    if (!(handle instanceof HTMLElement)) {
      throw new Error('Edge handle not found.')
    }

    const handleStyle = window.getComputedStyle(handle)

    return {
      transitionProperty: handleStyle.transitionProperty,
      backdropFilter: handleStyle.backdropFilter || handleStyle.webkitBackdropFilter,
      boxShadow: handleStyle.boxShadow
    }
  })
}

async function run() {
  await mkdir(outputDir, { recursive: true })

  const userDataDir = await mkdtemp(resolve(tmpdir(), 'coding-plan-usage-tracker-stage5-3-'))
  let electronApp

  try {
    ;({ electronApp } = await launchApplication(userDataDir))
    const mainWindow = await findWindowByTitle(electronApp, APP_TITLE)
    const settingsWindow = await openSettingsWindow(electronApp)

    await addZhipuProvider(settingsWindow)

    await waitFor(async () => {
      assert.equal(await mainWindow.locator('.collapsed-view__row').count() > 0, true)
      return true
    })

    const floatingMetrics = await getFloatingVisualMetrics(mainWindow)
    const floatingBackground = compositeOnBlack(parseColor(floatingMetrics.surfaceBackgroundColor))
    const floatingPrimaryContrast = getContrastRatio(
      parseColor(floatingMetrics.primaryTextColor),
      floatingBackground
    )
    const floatingSecondaryContrast = getContrastRatio(
      parseColor(floatingMetrics.secondaryTextColor),
      floatingBackground
    )

    assert.match(floatingMetrics.fontFamily, /Microsoft YaHei|PingFang SC|Segoe UI/i)
    assert.match(floatingMetrics.surfaceBackgroundImage, /gradient/i)
    assert.match(floatingMetrics.surfaceBackdropFilter, /blur/i)
    assert.match(floatingMetrics.windowTransitionProperty, /width|height|transform/i)
    assert.match(floatingMetrics.progressBackgroundImage, /gradient/i)
    assert.notEqual(floatingMetrics.progressBoxShadow, 'none')
    assert.match(floatingMetrics.progressTransitionProperty, /width|box-shadow/i)
    assert.equal(floatingPrimaryContrast >= 7, true)
    assert.equal(floatingSecondaryContrast >= 4.5, true)

    await mainWindow.screenshot({ path: resolve(outputDir, 'main-collapsed.png') })

    await mainWindow.evaluate(() => {
      window.__CPUT_RENDERER_DEBUG__.toggleExpand()
    })
    await waitFor(async () => {
      assert.equal(await mainWindow.locator('.expanded-view__dimension').count() > 0, true)
      return true
    })
    await mainWindow.screenshot({ path: resolve(outputDir, 'main-expanded.png') })

    await mainWindow.evaluate(() => {
      window.__CPUT_RENDERER_DEBUG__.updateConfig({ windowState: 'docked-right', isExpanded: false })
      window.electronAPI.setWindowState('docked-right')
    })
    await waitFor(async () => {
      assert.equal(await mainWindow.locator('.edge-handle').count(), 1)
      return true
    })

    const dockedMetrics = await getDockedHandleMetrics(mainWindow)
    assert.match(dockedMetrics.transitionProperty, /transform|box-shadow|opacity/i)
    assert.match(dockedMetrics.backdropFilter, /blur/i)
    assert.notEqual(dockedMetrics.boxShadow, 'none')
    await mainWindow.screenshot({ path: resolve(outputDir, 'main-docked.png') })

    await settingsWindow.bringToFront()
    const settingsMetrics = await getSettingsVisualMetrics(settingsWindow)
    const settingsBackground = compositeOnBlack(parseColor(settingsMetrics.headerBackgroundColor))
    const settingsDescriptionContrast = getContrastRatio(
      parseColor(settingsMetrics.descriptionColor),
      settingsBackground
    )

    assert.match(settingsMetrics.panelBackgroundImage, /gradient/i)
    assert.equal(settingsDescriptionContrast >= 4.5, true)
    assert.equal(settingsMetrics.descriptionLineHeightPixels >= 20, true)
    await settingsWindow.screenshot({
      path: resolve(outputDir, 'settings.png'),
      fullPage: true
    })

    console.log(
      JSON.stringify(
        {
          stage: '5.3',
          status: 'passed',
          screenshots: outputDir
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
