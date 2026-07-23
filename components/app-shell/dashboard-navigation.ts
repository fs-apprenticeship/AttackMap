export function isDashboardNavItemActive(
  pathname: string,
  href: string,
  matchDescendants: boolean,
): boolean {
  if (pathname === href) {
    return true;
  }

  return matchDescendants && pathname.startsWith(`${href}/`);
}
