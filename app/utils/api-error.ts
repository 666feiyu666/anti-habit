export function getApiErrorMessage(
  error: unknown,
  fallback = '操作失败，请稍后再试',
): string {
  const candidate = error as {
    data?: {
      data?: { message?: string }
      message?: string
    }
    statusMessage?: string
  } | null

  return candidate?.data?.data?.message
    ?? candidate?.data?.message
    ?? candidate?.statusMessage
    ?? fallback
}
