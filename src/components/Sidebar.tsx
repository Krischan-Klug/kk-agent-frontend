import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { session as sessionApi } from "@/lib/api";
import type { SessionState } from "@/types/api";
import {
  SidebarWrapper,
  Logo,
  NavItem,
  SidebarDivider,
  SidebarSection,
  SessionItem,
} from "./Sidebar.styled";

const navItems = [
  { href: "/chat", label: "Chat" },
  { href: "/session", label: "Sessions" },
  { href: "/agent", label: "Agents" },
  { href: "/mcp", label: "MCP" },
  { href: "/provider", label: "Provider" },
];

export default function Sidebar() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionState[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const data = await sessionApi.list();
      setSessions(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadSessions();
    setActiveSessionId(localStorage.getItem("activeSessionId"));

    function onSessionChanged() {
      loadSessions();
      setActiveSessionId(localStorage.getItem("activeSessionId"));
    }

    window.addEventListener("session-changed", onSessionChanged);
    window.addEventListener("storage", onSessionChanged);
    return () => {
      window.removeEventListener("session-changed", onSessionChanged);
      window.removeEventListener("storage", onSessionChanged);
    };
  }, [loadSessions]);

  function selectSession(id: string) {
    localStorage.setItem("activeSessionId", id);
    setActiveSessionId(id);
    window.dispatchEvent(new Event("session-changed"));
    router.push("/chat");
  }

  return (
    <SidebarWrapper>
      <Logo>KK Agent</Logo>
      {navItems.map((item) => (
        <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
          <NavItem
            $active={
              router.pathname === item.href ||
              (item.href === "/chat" && router.pathname === "/")
            }
          >
            {item.label}
          </NavItem>
        </Link>
      ))}

      {sessions.length > 0 && (
        <>
          <SidebarDivider />
          <SidebarSection>Sessions</SidebarSection>
          {sessions.map((s) => (
            <SessionItem
              key={s.id}
              $active={s.id === activeSessionId}
              onClick={() => selectSession(s.id)}
            >
              {s.name || s.id.slice(0, 8)}
            </SessionItem>
          ))}
        </>
      )}
    </SidebarWrapper>
  );
}
