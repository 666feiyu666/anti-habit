export function useIsDesktop() {
  const isDesktop = ref(false)

  onMounted(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const update = () => {
      isDesktop.value = query.matches
    }

    update()
    query.addEventListener('change', update)
    window.addEventListener('resize', update)
    onBeforeUnmount(() => {
      query.removeEventListener('change', update)
      window.removeEventListener('resize', update)
    })
  })

  return isDesktop
}
