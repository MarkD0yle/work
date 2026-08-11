import { useState, useRef, useEffect } from "react";
import { useOpportunities } from "../hooks/useOpportunities";
import { opportunityRepo } from "../lib/pitchPerfect/repo";
import type { Opportunity } from "../lib/pitchPerfect/types";
import { GlobalHeader } from "../components/pitchPerfect/GlobalHeader";
import { OpportunitiesHome, type BrowseTab } from "../components/pitchPerfect/views/OpportunitiesHome";
import { WorkspaceView } from "../components/pitchPerfect/views/WorkspaceView";
import { InsightsView } from "../components/pitchPerfect/InsightsView";

export const title = "Pitch Perfect";
export const fullWidth = true;

/* Pitch Perfect — spy scroll layout with vertical navigation. All workflow
 * sections (Dashboard, Define, Intelligence, Knowledge, Solution, Narrative,
 * Assets, Rehearse, Outcome) stack vertically and scroll. Active section is
 * highlighted in the fixed left sidebar as you scroll. Client & opportunity
 * selection via persistent GlobalHeader at top. */

type Section = "dashboard" | "yourpitch" | "define" | "intelligence" | "knowledge" | "solution" | "narrative" | "assets" | "rehearse" | "outcome" | "insights";

const SECTIONS: Array<{ id: Section; label: string; icon?: boolean }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "yourpitch", label: "Your Pitch" },
  { id: "define", label: "Define", icon: true },
  { id: "intelligence", label: "Intelligence", icon: true },
  { id: "knowledge", label: "Knowledge", icon: true },
  { id: "solution", label: "Solution", icon: true },
  { id: "narrative", label: "Narrative", icon: false },
  { id: "assets", label: "Assets", icon: false },
  { id: "rehearse", label: "Rehearse", icon: false },
  { id: "outcome", label: "Outcome", icon: false },
  { id: "insights", label: "Insights" },
];

export default function PitchPerfectPage() {
  const opportunities = useOpportunities();
  const [clientId, setClientId] = useState<string | null>(null);
  const [opportunityId, setOpportunityId] = useState<string | null>(null);
  const [browseTab, setBrowseTab] = useState<BrowseTab>("opportunities");
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sectionRefsRef = useRef<Record<Section, HTMLDivElement | null>>({
    dashboard: null,
    yourpitch: null,
    define: null,
    intelligence: null,
    knowledge: null,
    solution: null,
    narrative: null,
    assets: null,
    rehearse: null,
    outcome: null,
    insights: null,
  });

  const selected = opportunityId ? (opportunities.find((o) => o.id === opportunityId) ?? null) : null;

  function openOpportunity(opp: Opportunity) {
    setClientId(opp.clientId);
    setOpportunityId(opp.id);
  }

  function handleSelectClient(id: string | null) {
    setClientId(id);
    const first = id ? opportunities.find((o) => o.clientId === id) : undefined;
    setOpportunityId(first ? first.id : null);
  }

  function handleSelectOpportunity(id: string) {
    const opp = opportunities.find((o) => o.id === id);
    if (opp) openOpportunity(opp);
  }

  function handleOpenById(id: string) {
    const opp = opportunities.find((o) => o.id === id);
    if (opp) openOpportunity(opp);
  }

  function handleCreate(opportunity: Opportunity) {
    opportunityRepo.save(opportunity);
    setBrowseTab("opportunities");
    openOpportunity(opportunity);
  }

  function scrollToSection(section: Section) {
    const element = sectionRefsRef.current[section];
    if (element && scrollContainerRef.current) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Scrollspy: update active section based on scroll position
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      let current: Section = "dashboard";
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;

      for (const section of SECTIONS) {
        const element = sectionRefsRef.current[section.id];
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        const elementTop = rect.top + scrollTop;
        const elementCenter = elementTop + rect.height / 2;

        if (elementCenter <= scrollTop + containerHeight / 2) {
          current = section.id;
        }
      }

      setActiveSection(current);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <GlobalHeader
        clientId={clientId}
        opportunityId={opportunityId}
        opportunities={opportunities}
        onSelectClient={handleSelectClient}
        onSelectOpportunity={handleSelectOpportunity}
        onNewOpportunity={() => {
          setClientId(null);
          setOpportunityId(null);
          setBrowseTab("new");
          scrollToSection("dashboard");
        }}
        onBrowseAll={() => {
          setBrowseTab("opportunities");
          scrollToSection("dashboard");
        }}
        onInsights={() => scrollToSection("insights")}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-48 border-r border-neutral-200 bg-white py-4">
          <nav className="flex flex-col gap-1 px-2">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition ${
                  activeSection === section.id
                    ? "bg-neutral-100 text-neutral-900"
                    : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
                }`}
              >
                {section.icon && (
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      activeSection === section.id ? "bg-emerald-500" : "bg-neutral-300"
                    }`}
                    aria-hidden="true"
                  />
                )}
                {section.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content - Scrollable Sections */}
        <main
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-y-auto bg-neutral-50"
        >
          {/* Dashboard Section */}
          <section
            ref={(el) => {
              if (el) sectionRefsRef.current.dashboard = el;
            }}
            className="min-h-screen border-b border-neutral-200 bg-white p-8"
          >
            <h2 className="mb-6 text-2xl font-bold text-neutral-900">Dashboard</h2>
            {selected && <WorkspaceView opportunity={selected} />}
            {!selected && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center">
                <p className="text-neutral-600">Select an opportunity to view the dashboard</p>
              </div>
            )}
          </section>

          {/* Your Pitch Section */}
          <section
            ref={(el) => {
              if (el) sectionRefsRef.current.yourpitch = el;
            }}
            className="min-h-screen border-b border-neutral-200 bg-white p-8"
          >
            <h2 className="mb-6 text-2xl font-bold text-neutral-900">Your Pitch</h2>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center">
              <p className="text-neutral-600">Pitch narrative and presentation</p>
            </div>
          </section>

          {/* Define Section */}
          <section
            ref={(el) => {
              if (el) sectionRefsRef.current.define = el;
            }}
            className="min-h-screen border-b border-neutral-200 bg-white p-8"
          >
            <h2 className="mb-6 text-2xl font-bold text-neutral-900">Define</h2>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center">
              <p className="text-neutral-600">Opportunity definition</p>
            </div>
          </section>

          {/* Intelligence Section */}
          <section
            ref={(el) => {
              if (el) sectionRefsRef.current.intelligence = el;
            }}
            className="min-h-screen border-b border-neutral-200 bg-white p-8"
          >
            <h2 className="mb-6 text-2xl font-bold text-neutral-900">Intelligence</h2>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center">
              <p className="text-neutral-600">Research and market intelligence</p>
            </div>
          </section>

          {/* Knowledge Section */}
          <section
            ref={(el) => {
              if (el) sectionRefsRef.current.knowledge = el;
            }}
            className="min-h-screen border-b border-neutral-200 bg-white p-8"
          >
            <h2 className="mb-6 text-2xl font-bold text-neutral-900">Knowledge</h2>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center">
              <p className="text-neutral-600">Governed knowledge and insights</p>
            </div>
          </section>

          {/* Solution Section */}
          <section
            ref={(el) => {
              if (el) sectionRefsRef.current.solution = el;
            }}
            className="min-h-screen border-b border-neutral-200 bg-white p-8"
          >
            <h2 className="mb-6 text-2xl font-bold text-neutral-900">Solution</h2>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center">
              <p className="text-neutral-600">Solution design and structure</p>
            </div>
          </section>

          {/* Narrative Section */}
          <section
            ref={(el) => {
              if (el) sectionRefsRef.current.narrative = el;
            }}
            className="min-h-screen border-b border-neutral-200 bg-white p-8"
          >
            <h2 className="mb-6 text-2xl font-bold text-neutral-900">Narrative</h2>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center">
              <p className="text-neutral-600">Craft your pitch narrative</p>
            </div>
          </section>

          {/* Assets Section */}
          <section
            ref={(el) => {
              if (el) sectionRefsRef.current.assets = el;
            }}
            className="min-h-screen border-b border-neutral-200 bg-white p-8"
          >
            <h2 className="mb-6 text-2xl font-bold text-neutral-900">Assets</h2>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center">
              <p className="text-neutral-600">Generate presentation assets</p>
            </div>
          </section>

          {/* Rehearse Section */}
          <section
            ref={(el) => {
              if (el) sectionRefsRef.current.rehearse = el;
            }}
            className="min-h-screen border-b border-neutral-200 bg-white p-8"
          >
            <h2 className="mb-6 text-2xl font-bold text-neutral-900">Rehearse</h2>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center">
              <p className="text-neutral-600">Practice and rehearse your pitch</p>
            </div>
          </section>

          {/* Outcome Section */}
          <section
            ref={(el) => {
              if (el) sectionRefsRef.current.outcome = el;
            }}
            className="min-h-screen border-b border-neutral-200 bg-white p-8"
          >
            <h2 className="mb-6 text-2xl font-bold text-neutral-900">Outcome</h2>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center">
              <p className="text-neutral-600">Capture pitch outcome and results</p>
            </div>
          </section>

          {/* Insights Section */}
          <section
            ref={(el) => {
              if (el) sectionRefsRef.current.insights = el;
            }}
            className="min-h-screen border-b border-neutral-200 bg-white p-8"
          >
            <h2 className="mb-6 text-2xl font-bold text-neutral-900">Insights</h2>
            <InsightsView onBack={() => scrollToSection("dashboard")} />
          </section>
        </main>
      </div>
    </div>
  );
}
