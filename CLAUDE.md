# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Desktop floating window application for monitoring AI Coding Plan quota usage across multiple providers. Built with Electron 34, React 19, TypeScript, and Vite 6. Target platform: Windows.

## Development Commands

```bash
# Development
npm run dev                    # Start dev server with hot reload
npm run typecheck             # Type check both main and renderer processes
npm run lint                  # Run ESLint
npm run format                # Format code with Prettier

# Building
npm run build:app             # Build app (typecheck + electron-vite build)
npm run build                 # Build Windows installer (includes build:app)
npm run build:unpack          # Build unpacked directory for testing
npm run build:mac             # Build macOS installer
npm run build:linux           # Build Linux installer

# Installation (China mirror)
npm run install:cn            # Install with Chinese npm mirrors
```

## Architecture

### Electron Process Structure

**Main Process** (`src/main/`):
- `main.ts` - App lifecycle, IPC handlers, provider API fetching logic
- `window.ts` - Floating window creation, drag, edge docking behavior
- `tray.ts` - System tray menu and actions
- `configStore.ts` - Persistent config using electron-store

**Preload** (`src/preload/`):
- Exposes safe IPC APIs to renderer via `window.electronAPI`

**Renderer Process** (`src/renderer/`):
- React app with context-based state management
- `context/AppContext.tsx` - Global state (config, usage data, UI state) with reducer pattern
- `hooks/` - Custom hooks for window drag and auto-refresh
- `providers/` - Provider registry and individual provider implementations
- `components/` - UI components (FloatingWindow, CollapsedView, ExpandedView, SettingsPanel, EdgeHandle)

### Provider System

Providers are registered in `src/renderer/providers/providerRegistry.ts`. Each provider implements the `IProvider` interface from `src/shared/types.ts`:

- `id` - Unique identifier (e.g., 'zhipu', 'bailian')
- `name` - Display name
- `icon` - Icon path or base64
- `getAuthFields()` - Returns auth field definitions
- `fetchUsage(authConfig)` - Returns quota dimensions with usage percentages

**Current Providers:**
- `zhipuProvider` - CodeGeeX (real API integration)
- `bailianProvider` - Alibaba Bailian (mock data, hidden from UI by default)

**Adding a new provider:**
1. Create provider file in `src/renderer/providers/`
2. Implement `IProvider` interface
3. Register in `providerRegistry.ts`
4. Add API fetching logic in `src/main/main.ts` `handleUsageFetch()`

### State Management

Uses React Context + useReducer pattern in `AppContext.tsx`. Key actions:
- `SET_CONFIG` - Update app configuration
- `SET_USAGE_DATA` - Update provider usage data
- `TOGGLE_DIMENSION` - Toggle dimension visibility in collapsed view
- `TOGGLE_EXPAND` - Switch between collapsed/expanded states
- `TOGGLE_SETTINGS` - Open/close settings panel

Config is automatically persisted to electron-store and synced across all windows.

### Window Behavior

- **Drag**: Implemented in `useWindowDrag.ts` hook, communicates position to main process
- **Edge Docking**: When dragged near screen edge, window docks and shows edge handle
- **Edge Handle**: Click to restore from docked state
- **Always on Top**: Floating window stays above other windows
- **Transparent**: Uses transparent window with custom chrome

### API Integration

Provider API calls happen in **main process** (`src/main/main.ts`):
- Renderer calls `window.electronAPI.fetchUsage(providerId, authConfig)`
- Main process handles HTTP requests via Node.js `https` module
- Returns structured data or error messages
- Supports fixture mode for testing via environment variables

## Testing & E2E

E2E mode enabled via `CODING_PLAN_USAGE_TRACKER_E2E=1`. Exposes `__CPUT_E2E__` global API for Playwright tests.

Fixture mode for Zhipu API:
- `CODING_PLAN_USAGE_TRACKER_FIXTURE_ZHIPU=1` - Enable fixtures
- `CODING_PLAN_USAGE_TRACKER_FIXTURE_ZHIPU_MODE=success|auth-error|offline|malformed` - Set fixture scenario

## Key Files

- `src/shared/types.ts` - Shared TypeScript interfaces
- `src/main/main.ts` - Main process entry, IPC handlers, API logic
- `src/renderer/context/AppContext.tsx` - Global state management
- `src/renderer/providers/providerRegistry.ts` - Provider registration
- `electron.vite.config.ts` - Build configuration
- `package.json` - Scripts and dependencies

## Configuration Persistence

Uses `electron-store` to persist:
- Window position and docking state
- Provider configurations (auth tokens, enabled state)
- Checked dimensions for collapsed view
- Refresh interval
- Expanded/collapsed state

Config is stored in OS-specific app data directory and survives app restarts.
