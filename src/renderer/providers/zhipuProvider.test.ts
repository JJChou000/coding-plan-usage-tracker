import { afterEach, describe, expect, it, vi } from 'vitest'
import zhipuProvider, { parseZhipuUsageResponse } from './zhipuProvider'

describe('zhipuProvider', () => {
  it('uses 智谱 as the user-facing provider name', () => {
    expect(zhipuProvider.name).toBe('智谱')
  })
})

describe('parseZhipuUsageResponse', () => {
  it('should parse valid legacy response with TOKENS_LIMIT and TIME_LIMIT', () => {
    const mockResponse = {
      quotaLimit: {
        data: {
          limits: [
            {
              type: 'TOKENS_LIMIT',
              unit: 3,
              number: 5,
              usage: 200000,
              currentValue: 62000,
              nextResetTime: Date.now() + 2 * 60 * 60 * 1000
            },
            {
              type: 'TIME_LIMIT',
              unit: 5,
              number: 1,
              usage: 2000,
              currentValue: 240
            }
          ]
        }
      }
    }

    const result = parseZhipuUsageResponse(mockResponse)

    expect(result.providerId).toBe('zhipu')
    expect(result.dimensions).toHaveLength(2)
    expect(result.dimensions[0].id).toBe('token_5h')
    expect(result.dimensions[0].usedPercent).toBe(31)
    expect(result.dimensions[1].id).toBe('mcp_monthly')
    expect(result.dimensions[1].usedPercent).toBe(12)
  })

  it('parses the weekly dimension when TOKENS_LIMIT + unit=6 + number=1 is present', () => {
    const mockResponse = {
      quotaLimit: {
        data: {
          limits: [
            {
              type: 'TOKENS_LIMIT',
              unit: 3,
              number: 5,
              usage: 200000,
              currentValue: 62000,
              nextResetTime: new Date(2026, 2, 24, 16, 30, 0).getTime()
            },
            {
              type: 'TOKENS_LIMIT',
              unit: 6,
              number: 1,
              usage: 6000,
              currentValue: 1500,
              nextResetTime: new Date(2026, 2, 31, 0, 0, 0).getTime()
            },
            {
              type: 'TIME_LIMIT',
              unit: 5,
              number: 1,
              usage: 2000,
              currentValue: 240,
              nextResetTime: new Date(2026, 3, 1, 0, 0, 0).getTime()
            }
          ]
        }
      }
    }

    const result = parseZhipuUsageResponse(mockResponse)

    expect(result.dimensions.map((dimension) => dimension.id)).toEqual([
      'token_5h',
      'token_weekly',
      'mcp_monthly'
    ])
    expect(result.dimensions[1]).toMatchObject({
      id: 'token_weekly',
      label: '每周用量',
      usedPercent: 25,
      resetTime: '2026-03-31 00:00'
    })
  })

  it('does not infer a weekly dimension when unit=6 + number=1 is missing', () => {
    const mockResponse = {
      quotaLimit: {
        data: {
          limits: [
            {
              type: 'TOKENS_LIMIT',
              unit: 3,
              number: 5,
              usage: 200000,
              currentValue: 62000,
              nextResetTime: new Date(2026, 2, 24, 16, 30, 0).getTime()
            },
            {
              type: 'TOKENS_LIMIT',
              unit: 6,
              number: 2,
              usage: 6000,
              currentValue: 1500,
              nextResetTime: new Date(2026, 2, 31, 0, 0, 0).getTime()
            },
            {
              type: 'TIME_LIMIT',
              unit: 5,
              number: 1,
              usage: 2000,
              currentValue: 240,
              nextResetTime: new Date(2026, 3, 1, 0, 0, 0).getTime()
            }
          ]
        }
      }
    }

    const result = parseZhipuUsageResponse(mockResponse)

    expect(result.dimensions.map((dimension) => dimension.id)).toEqual([
      'token_5h',
      'mcp_monthly'
    ])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('formats token and MCP reset times with different semantics', () => {
    const tokenResetTime = new Date(2026, 2, 24, 16, 30, 0).getTime()
    const monthlyResetTime = new Date(2026, 3, 1, 0, 0, 0).getTime()
    const mockResponse = {
      quotaLimit: {
        data: {
          limits: [
            {
              type: 'TOKENS_LIMIT',
              unit: 3,
              number: 5,
              usage: 200000,
              currentValue: 62000,
              nextResetTime: tokenResetTime
            },
            {
              type: 'TOKENS_LIMIT',
              unit: 6,
              number: 1,
              usage: 6000,
              currentValue: 1500,
              nextResetTime: new Date(2026, 2, 31, 0, 0, 0).getTime()
            },
            {
              type: 'TIME_LIMIT',
              unit: 5,
              number: 1,
              usage: 2000,
              currentValue: 240,
              nextResetTime: monthlyResetTime
            }
          ]
        }
      }
    }

    const result = parseZhipuUsageResponse(mockResponse)

    expect(result.dimensions[0]?.resetTime).toBe('16:30')
    expect(result.dimensions[1]?.resetTime).toBe('2026-03-31 00:00')
    expect(result.dimensions[2]?.resetTime).toBe('2026-04-01 00:00')
  })

  it('falls back to the start of next month when MCP reset time is missing', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 2, 24, 9, 0, 0).getTime())

    const mockResponse = {
      quotaLimit: {
        data: {
          limits: [
            {
              type: 'TOKENS_LIMIT',
              unit: 3,
              number: 5,
              usage: 200000,
              currentValue: 62000,
              nextResetTime: new Date(2026, 2, 24, 14, 0, 0).getTime()
            },
            {
              type: 'TIME_LIMIT',
              unit: 5,
              number: 1,
              usage: 2000,
              currentValue: 240
            }
          ]
        }
      }
    }

    const result = parseZhipuUsageResponse(mockResponse)

    expect(result.dimensions[1]?.resetTime).toBe('2026-04-01 00:00')
  })

  it('should handle missing limits', () => {
    const result = parseZhipuUsageResponse({})

    expect(result.providerId).toBe('zhipu')
    expect(result.dimensions).toHaveLength(0)
    expect(result.error).toBeDefined()
  })

  it('should handle string numbers', () => {
    const mockResponse = {
      quotaLimit: {
        data: {
          limits: [
            {
              type: 'TOKENS_LIMIT',
              unit: 3,
              number: 5,
              usage: '100000',
              currentValue: '50000'
            }
          ]
        }
      }
    }

    const result = parseZhipuUsageResponse(mockResponse)

    expect(result.dimensions[0].usedPercent).toBe(50)
  })
})
