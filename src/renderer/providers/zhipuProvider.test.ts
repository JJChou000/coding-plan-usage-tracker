import { describe, it, expect } from 'vitest'
import { parseZhipuUsageResponse } from './zhipuProvider'

describe('parseZhipuUsageResponse', () => {
  it('should parse valid response with TOKENS_LIMIT and TIME_LIMIT', () => {
    const mockResponse = {
      quotaLimit: {
        data: {
          limits: [
            {
              type: 'TOKENS_LIMIT',
              usage: 200000,
              currentValue: 62000,
              nextResetTime: Date.now() + 2 * 60 * 60 * 1000
            },
            {
              type: 'TIME_LIMIT',
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
