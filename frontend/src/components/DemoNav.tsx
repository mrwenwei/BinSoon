import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { Mascot } from "./Mascot";
import type { NavLink } from "./AppNav";

// M flow 共用導覽：同一組連結在桌面頂部、手機底部呈現。
export function DemoNav({
  tabs,
  crew,
  right,
  account,
}: {
  tabs: NavLink[];
  crew: boolean;
  right: ReactNode;
  account?: ReactNode;
}) {
  return (
    <>
      <header className="topbar m-topbar">
        <a className="brand" href="#map">
          <span className="brand-mark">
            <Mascot />
          </span>
          <span>
            BinSoon<span className="brand-sub">台北丟垃圾變順</span>
          </span>
        </a>
        <nav className="demo-identity" aria-label="身份切換">
          <span className="label">身份</span>
          <a href="#login?next=map" aria-current={!crew ? "page" : undefined}>
            市民
          </a>
          <a href="#crew/login" aria-current={crew ? "page" : undefined}>
            清潔隊
          </a>
        </nav>
        <div className="topbar-right">
          {right}
          {account && <div className="topbar-account">{account}</div>}
        </div>
      </header>
      {
        <nav className="m-tabs" aria-label="主要分頁">
          {tabs.map((link, i) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={link.current ? "page" : undefined}
            >
              <span aria-hidden="true" className="m-tab-icon">
                <Icon
                  name={
                    (crew
                      ? (["report", "route", "truck", "star"] as const)
                      : (["map", "pin", "truck", "user"] as const))[i]
                  }
                />
              </span>
              {link.label}
            </a>
          ))}
        </nav>
      }
    </>
  );
}
