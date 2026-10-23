import { useCallback } from "react";
import { AppShell } from "./shell/AppShell";
import { ROUTES } from "./screens/registry";
import { usePersisted } from "./lib/persist";

export default function ExecutionAnalyticsApp() {
  const [stored, setRoute] = usePersisted<string>("route", "home");
  const route = ROUTES[stored] ? stored : "home";
  const navigate = useCallback((r: string) => setRoute(r), [setRoute]);
  const { component: Screen, layout } = ROUTES[route];
  return (
    <AppShell route={route} onNavigate={navigate} layout={layout}>
      <Screen key={route} />
    </AppShell>
  );
}
