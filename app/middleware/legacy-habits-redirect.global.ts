export default defineNuxtRouteMiddleware((to) => {
  if (to.path !== '/') return

  const hasGoal = typeof to.query.goal === 'string'
  const hasDate = typeof to.query.date === 'string'
  if (!hasGoal && !hasDate) return

  return navigateTo({ path: '/habits', query: to.query }, { redirectCode: 302 })
})
