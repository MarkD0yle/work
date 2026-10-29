import { ArrowRight, BellRing, Clock, FileText, Play, Star } from "lucide-react";
import { useMemo } from "react";
import { Banner, Button, EmptyState, Skeleton } from "../ui";
import { NAV, routeLabel } from "../config/nav";
import { USER_NAME } from "../config/brand";
import { AS_OF } from "../lib/dates";
import { formatDate } from "../lib/format";
import { buildReportFiles, EXCEPTION_RULES } from "../data/mock";
import { useInitialLoad, usePreviewState, useShell } from "../shell";

const greeting = () => "Good morning";

function Card({ title, icon, children, size = "ea-col-4" }: { title: string; icon: React.ReactNode; children: React.ReactNode; size?: string }) {
  return (
    <section className={`ea-panel ${size}`} aria-label={title}>
      <div className="ea-panel-head" style={{ paddingLeft: 12, gap: 8 }}>{icon}<h2 className="ea-section-title">{title}</h2></div>
      <div className="ea-panel-body" style={{ minHeight: 180 }}>{children}</div>
    </section>
  );
}

export default function Home() {
  const { navigate, favorites } = useShell();
  const loading = useInitialLoad(400);
  const preview = usePreviewState();
  const showLoading = loading || preview === "loading";
  const recent = useMemo(() => buildReportFiles().filter((f) => f.source !== "deleted").slice(0, 5), []);
  const alerts = preview === "empty" ? [] : EXCEPTION_RULES.filter((r) => r.enabled && r.category === "FX").slice(0, 2);
  const favs = preview === "empty" ? [] : favorites;
  const sk = <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={14} width={`${90 - i * 12}%`} />)}</div>;

  return (
    <div className="ea-page" style={{ gap: 24 }}>
      <div className="ea-page-head">
        <div>
          <h1 className="ea-title">{greeting()}, {USER_NAME}</h1>
          <div className="ea-muted">{formatDate(AS_OF)}</div>
        </div>
        <Button variant="primary" icon={<Play size={16} strokeWidth={1.5} />} onClick={() => navigate("run-report")}>Run post-trade report</Button>
      </div>
      {preview === "error" && <Banner tone="error" onRetry={() => undefined}>Some home cards could not be loaded.</Banner>}

      <div className="ea-grid">
        <Card title="Recent reports" icon={<FileText size={18} strokeWidth={1.5} />}>
          {showLoading ? sk : recent.length === 0 || preview === "empty" ? (
            <EmptyState title="No reports yet" hint="Reports you run will appear here." action={<Button variant="secondary" size="compact" onClick={() => navigate("run-report")}>Run a report</Button>} />
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
              {recent.map((f) => (
                <li key={f.id}>
                  <button className="ea-menu-item" style={{ justifyContent: "space-between" }} onClick={() => navigate("review-reports")}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{f.fileName}</span><span className="ea-caption">{formatDate(f.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Alerts" icon={<BellRing size={18} strokeWidth={1.5} />}>
          {showLoading ? sk : alerts.length === 0 ? (
            <Banner tone="success">No exceptions in the last 24h</Banner>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              {alerts.map((a) => (
                <li key={a.id}>
                  <button className="ea-menu-item" onClick={() => navigate("exception-reporting")}>
                    <Clock size={14} aria-hidden /><span style={{ flex: 1, textAlign: "left" }}>{a.name}</span><span className="ea-badge" data-tone="warning">Triggered</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Favorites" icon={<Star size={18} strokeWidth={1.5} />}>
          {showLoading ? sk : favs.length === 0 ? (
            <EmptyState title="No saved favorites" hint="Use the star in the toolbar to save the page you are on." />
          ) : (
            favs.map((f) => <button key={f} className="ea-menu-item" onClick={() => navigate(f)}>{routeLabel(f)}</button>)
          )}
        </Card>
      </div>

      <section aria-label="Shortcuts" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 className="ea-section-title">Shortcuts</h2>
        <div className="ea-grid">
          {NAV.filter((g) => g.id !== "home").map((g) => (
            <div key={g.id} className="ea-panel ea-col-4" role="group" aria-label={g.label}>
              <div className="ea-panel-head" style={{ paddingLeft: 12, gap: 8 }}><g.icon size={18} strokeWidth={1.5} aria-hidden /><h3 className="ea-section-title">{g.label}</h3></div>
              <div className="ea-panel-body" style={{ padding: 4 }}>
                {g.items.map((it) => (
                  <button key={it.id} className="ea-menu-item" onClick={() => navigate(it.route)}>
                    <ArrowRight size={14} aria-hidden /><span>{it.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
