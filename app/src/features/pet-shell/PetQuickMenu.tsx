import type { PetScale } from '../../platform/window/layout';
import { PetScaleControl } from './PetScaleControl';

export function PetQuickMenu({ open, scale, onBackend, onChat, onExit, onScaleChange }: {
  open: boolean;
  scale: PetScale;
  onBackend: () => void;
  onChat: () => void;
  onExit: () => void;
  onScaleChange: (scale: PetScale) => void;
}) {
  return (
    <nav className={`pet-quick-menu ${open ? 'is-open' : ''}`} aria-label="桌宠菜单" aria-hidden={!open}>
      <MenuButton label="后台" icon="backend" open={open} onClick={onBackend} />
      <MenuButton label="对话" icon="chat" open={open} onClick={onChat} />
      <MenuButton label="退出" icon="exit" open={open} danger onClick={onExit} />
      <PetScaleControl scale={scale} interactive={open} onChange={onScaleChange} />
    </nav>
  );
}

function MenuButton({ label, icon, open, danger = false, onClick }: {
  label: string;
  icon: 'backend' | 'chat' | 'exit';
  open: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={danger ? 'is-danger' : ''} type="button" tabIndex={open ? 0 : -1} onClick={onClick}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {icon === 'backend' && <><rect x="4" y="5" width="16" height="14" rx="2.5" /><path d="M9 5v14M12 9h5M12 13h4" /></>}
        {icon === 'chat' && <><path d="M5 6.5h14v9H11l-4.5 3v-3H5v-9Z" /><path d="M9 10.8h.01M12 10.8h.01M15 10.8h.01" /></>}
        {icon === 'exit' && <><path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10M14.5 8l4 4-4 4M9 12h9" /></>}
      </svg>
      <span>{label}</span>
    </button>
  );
}

