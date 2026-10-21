import { useEffect } from "react";

type MemberSection =
  "member" | "reports" | "point-history" | "redemptions" | "notifications";

export function MemberNavigation({ current }: { current: MemberSection }) {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [current]);
  return (
    <nav className="member-page-tabs" aria-label="會員中心區塊">
      {[
        { page: "member", label: "集章與等級" },
        { page: "reports", label: "我的回報" },
        { page: "point-history", label: "點數歷史紀錄" },
        { page: "redemptions", label: "我的兌換" },
        { page: "notifications", label: "通知與進度" },
      ].map((item) => (
        <a
          key={item.page}
          href={"#" + item.page}
          aria-current={current === item.page ? "page" : undefined}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
