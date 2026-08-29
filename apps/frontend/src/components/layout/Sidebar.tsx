import { NavLink, useNavigate } from 'react-router-dom';
import type { AuthUser, EmailStatus } from '@repo/shared';
import { cn } from '@/lib/cn';
import { ChevronDownIcon, ClockIcon, SendIcon } from '@/components/icons';
import { UserMenu } from './UserMenu';

export interface SidebarProps {
  user: AuthUser;
  counts: Record<Extract<EmailStatus, 'SCHEDULED' | 'SENT'>, number | undefined>;
  activeStatus: Extract<EmailStatus, 'SCHEDULED' | 'SENT'>;
  onSelectStatus: (status: Extract<EmailStatus, 'SCHEDULED' | 'SENT'>) => void;
}

/**
 * Blocky "ONB" wordmark from the design, drawn as a 5x7 bitmap per glyph rather
 * than shipped as an asset so it stays crisp at any zoom and inherits the ink
 * colour.
 */
const WORDMARK_GLYPHS = [
  // '#' is a filled cell, '.' is empty.
  ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
];

function Wordmark() {
  return (
    <div className="flex items-center gap-[4px]" aria-label="ONB" role="img">
      {WORDMARK_GLYPHS.map((glyph, gi) => (
        <div key={gi} className="grid grid-cols-5 gap-px">
          {glyph.flatMap((row, ri) =>
            [...row].map((cell, ci) => (
              <span
                key={`${ri}-${ci}`}
                className={cn('h-[5px] w-[5px]', cell === '#' ? 'bg-ink' : 'bg-transparent')}
              />
            )),
          )}
        </div>
      ))}
    </div>
  );
}

interface NavItemProps {
  label: string;
  count: number | undefined;
  active: boolean;
  icon: React.ReactNode;
  onClick: () => void;
}

function NavItem({ label, count, active, icon, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] transition-colors',
        active ? 'bg-brand-50 font-semibold text-ink' : 'text-ink-muted hover:bg-field',
      )}
    >
      <span className={active ? 'text-ink' : 'text-ink-muted'}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {/* Undefined while the first fetch is in flight - render nothing rather
          than a flashing 0 that then jumps to the real count. */}
      {count !== undefined && (
        <span className={cn('text-sm', active ? 'text-ink' : 'text-ink-faint')}>{count}</span>
      )}
    </button>
  );
}

export function Sidebar({ user, counts, activeStatus, onSelectStatus }: SidebarProps) {
  const navigate = useNavigate();

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-line bg-white px-4 py-5">
      <div className="mb-6 pl-2">
        <Wordmark />
      </div>

      <UserMenu user={user}>
        <div className="flex w-full items-center gap-3 rounded-2xl bg-field px-3 py-2.5 text-left transition-colors hover:bg-line">
          <Avatar user={user} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[15px] font-semibold text-ink">{user.name}</p>
            <p className="truncate text-[13px] text-ink-muted">{user.email}</p>
          </div>
          <ChevronDownIcon className="h-4 w-4 shrink-0 text-ink-muted" />
        </div>
      </UserMenu>

      <button
        onClick={() => navigate('/compose')}
        className="mt-4 h-[46px] w-full rounded-full border border-brand-500 text-[15px] font-medium text-brand-500 transition-colors hover:bg-brand-50"
      >
        Compose
      </button>

      <p className="mb-2 mt-7 px-4 text-[12px] font-medium uppercase tracking-wider text-ink-faint">
        Core
      </p>

      <nav className="space-y-1">
        <NavItem
          label="Scheduled"
          count={counts.SCHEDULED}
          active={activeStatus === 'SCHEDULED'}
          icon={<ClockIcon className="h-[18px] w-[18px]" />}
          onClick={() => onSelectStatus('SCHEDULED')}
        />
        <NavItem
          label="Sent"
          count={counts.SENT}
          active={activeStatus === 'SENT'}
          icon={<SendIcon className="h-[18px] w-[18px]" />}
          onClick={() => onSelectStatus('SENT')}
        />
      </nav>
    </aside>
  );
}

export function Avatar({ user, size = 40 }: { user: AuthUser; size?: number }) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        width={size}
        height={size}
        // Google's CDN returns 403 for profile images requested with a
        // referrer from another origin.
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-brand-500 font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {user.name.charAt(0).toUpperCase()}
    </div>
  );
}

// Re-exported so NavLink stays available to callers that route by URL.
export { NavLink };
