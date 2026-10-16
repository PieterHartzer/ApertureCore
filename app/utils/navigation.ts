export const isNavigationSectionActive = (routePath: string, sectionPath: string) => {
  const path = routePath.toLowerCase().replace(/\/+$/, '') || '/'
  return sectionPath === '/' ? path === '/' : path === sectionPath || path.startsWith(`${sectionPath}/`)
}
