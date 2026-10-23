import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Mascot } from "./Mascot";

export type NavLink = { href: string; label: string; current?: boolean };
export type NavSection = { title: string; links: NavLink[] };

// 頂欄＋左側漢堡選單（手機與桌面共用）。
// 手機：漢堡｜地圖｜設桶投票分頁｜右上點數按鈕（會員中心）；不放 Logo、沒有底部導覽列。
// 桌面：漢堡＋Logo＋原有主選單＋點數按鈕＋帳號；其他入口都在側邊欄。
export function AppNav({
  tabs,
  desktopLinks,
  sections,
  right,
  account,
  drawerFooter,
}: {
  tabs: NavLink[];
  desktopLinks: NavLink[];
  sections: NavSection[];
  right: ReactNode;
  account?: ReactNode;
  drawerFooter?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);
  const titleId = useId();
  const drawerId = useId();
  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) button.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    const onHash = () => setOpen(false);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (!open) return;
    const panel = drawer.current!;
    const focusables = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      );
    focusables()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);
  return (
    <>
      <header className="topbar">
        <button
          ref={button}
          type="button"
          className="menu-button"
          aria-label="開啟選單"
          aria-expanded={open}
          aria-controls={drawerId}
          onClick={() => setOpen(true)}
        >
          <span aria-hidden="true" className="menu-icon" />
        </button>
        <a className="brand" href="#map">
          <span className="brand-mark">
            <Mascot />
          </span>
          <span>
            BinSoon<span className="brand-sub">台北丟垃圾變順</span>
          </span>
        </a>
        <nav className="primary-tabs" aria-label="主要分頁">
          {tabs.map((link) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={link.current ? "page" : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <nav className="desktop-nav" aria-label="主選單">
          {desktopLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={link.current ? "page" : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="topbar-right">
          {right}
          {account && <div className="topbar-account">{account}</div>}
        </div>
      </header>
      <div
        className={`drawer-scrim ${open ? "open" : ""}`}
        aria-hidden="true"
        onClick={() => close()}
      />
      <aside
        ref={drawer}
        id={drawerId}
        className={`drawer ${open ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        inert={!open}
      >
        <div className="drawer-head">
          <span className="brand-mark" aria-hidden="true">
            <Mascot />
          </span>
          <strong id={titleId}>
            BinSoon<span className="brand-sub">選單</span>
          </strong>
          <button
            type="button"
            className="drawer-close"
            aria-label="關閉選單"
            onClick={() => close()}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <nav className="drawer-nav" aria-label="側邊選單">
          {sections.map((section) => (
            <div className="drawer-section" key={section.title}>
              <span className="label">{section.title}</span>
              <ul>
                {section.links.map((link) => (
                  <li key={link.href + link.label}>
                    <a
                      href={link.href}
                      aria-current={link.current ? "page" : undefined}
                      onClick={() => close(false)}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        {drawerFooter && (
          <div
            className="drawer-foot"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("button")) close();
            }}
          >
            {drawerFooter}
          </div>
        )}
      </aside>
    </>
  );
}
