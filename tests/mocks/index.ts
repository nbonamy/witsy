

import { vi } from 'vitest'

export const createDialogMock = (respond?: (args) => Partial<{
  isConfirmed: boolean
  isDenied: boolean
  isDismissed: boolean
  value?: any
}>) => {

  const defaultResponse = {
    isConfirmed: true,
    isDenied: false,
    isDismissed: false,
  }

  return {
    default: {
      alert: vi.fn((args) => Promise.resolve({
        ...defaultResponse,
        ...respond?.(args)
      })),
      show: vi.fn((args) => Promise.resolve({
      ...defaultResponse,
      ...respond?.(args)
    })),
    }
  }

}
