import type { Page } from '@playwright/test';

export async function openSectionItem(
  page: Page,
  section: string,
  item?: string,
) {
  const navigation = page.getByRole('navigation', {
    name: 'Primary navigation',
  });
  await navigation.getByRole('button', { name: section, exact: true }).click();
  if (!item || item === section) return;
  const sectionNavigation = page.getByRole('navigation', {
    name: 'Section navigation',
  });
  const destination =
    item === 'Imports'
      ? sectionNavigation.getByRole('link', { name: item, exact: true })
      : sectionNavigation.getByRole('button', { name: item, exact: true });
  await destination.click();
}
