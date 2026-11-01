import { NavLink } from 'react-router';

import { cn } from './lib/utils';

// Each tab has its own address, so going back and reloading keep the chosen one.
export function CategoryTabs({
  path,
  tabs,
}: {
  path: string;
  tabs: readonly { key: string; label: string }[];
}) {
  return (
    <nav aria-label="분야" className="-mx-1 overflow-x-auto border-b px-1">
      <ul className="flex w-max gap-1">
        {tabs.map(({ key, label }) => (
          <li key={key}>
            <NavLink
              to={`${path}/${key}`}
              className={({ isActive }) =>
                cn(
                  'inline-flex min-h-11 items-center border-b-2 px-3 text-body-sm font-medium whitespace-nowrap',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )
              }
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
