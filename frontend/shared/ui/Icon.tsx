import type { SVGProps } from "react";

export type IconName = "back" | "more" | "comment" | "heart" | "pencil" | "trash" | "chevron-down" | "send";

type IconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: IconName;
  /** heart 처럼 채움/선 두 모양이 있는 아이콘용. */
  filled?: boolean;
};

/** 시안 해상도가 낮아 형태만 참고해 직접 만든 24x24 아이콘. 색은 현재 글자색(currentColor)을 따른다. */
export function Icon({ name, filled = false, ...props }: IconProps) {
  const common = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };

  switch (name) {
    case "back":
      return (
        <svg {...common}>
          <path d="M15 5l-7 7 7 7" />
        </svg>
      );
    case "more":
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      );
    case "comment":
      return (
        <svg {...common}>
          <path d="M4 5h16v11H10l-4 4v-4H4z" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common} fill={filled ? "currentColor" : "none"}>
          <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
        </svg>
      );
    case "pencil":
      return (
        <svg {...common}>
          <path d="M4 20l1-4L16 5l3 3L8 19z" />
          <path d="M14 7l3 3" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path d="M5 7h14" />
          <path d="M10 7V4h4v3" />
          <path d="M7 7l1 13h8l1-13" />
        </svg>
      );
    case "chevron-down":
      return (
        <svg {...common}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      );
    case "send":
      return (
        <svg {...common} fill="currentColor">
          <path d="M4 12L20 4l-6 16-3-7z" />
        </svg>
      );
  }
}
