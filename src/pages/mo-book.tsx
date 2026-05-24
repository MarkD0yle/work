import { useEffect, useRef, useState, type ReactNode } from "react";

export const title = "Mo Book Landing";
export const fullWidth = true;

/* ------------------------------------------------------------------ *
 * Landing page for the children's picture book
 *   "The Girl Called Mo'" by Mo Labiyi
 *
 * Mo is a bright, kind little girl who travels the world — by car,
 * train, boat and plane — learning new things and making friends.
 * The page leans into that: a sunny storybook hero, a hand-built SVG
 * of Mo, and big bubbly type. Everything is self-contained (palette,
 * fonts, keyframes) so it stays isolated from the other workspace pages.
 * ------------------------------------------------------------------ */

/* ---------- Palette (pulled from the book art) ---------- */
const C = {
  sky: "#9bd6f2",
  skyDeep: "#74c3ec",
  sun: "#ffd84d",
  cloud: "#ffffff",
  hillFront: "#7fcf8e",
  hillBack: "#a7e0a0",
  path: "#e7a96b",
  water: "#5bbcd6",
  pink: "#f59bc0",
  pinkDeep: "#ec5f9e",
  purple: "#7b4ea3",
  denim: "#4a90d9",
  denimDeep: "#3a73b0",
  skin: "#c2784a",
  skinShade: "#a8623a",
  hair: "#5a3a2a",
  hairLite: "#7a5038",
  red: "#e2453c",
  cream: "#fff7ea",
  lilac: "#f3ecfa",
  gold: "#ffb800",
};

/* ================================================================== */

export default function MoBookLanding() {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={scrollRef}
      className="relative h-full overflow-y-auto scroll-smooth"
      style={{
        fontFamily: "'Nunito', system-ui, sans-serif",
        color: "#3a2c4a",
        background: C.cream,
      }}
    >
      <Styles />

      <Hero />
      <MeetMo />
      <Travel />
      <QuoteBand />
      <WhatsInside />
      <Reviews />
      <PreOrder />
      <Footer />

      <StickyCTA scrollRef={scrollRef} />
    </div>
  );
}

/* ================================================================== *
 * Reveal-on-scroll + scroll helpers
 * ================================================================== */

const reduceMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Reveal({
  children,
  delay = 0,
  y = 28,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(reduceMotion());

  useEffect(() => {
    if (reduceMotion()) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }),
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : `translateY(${y}px)`,
        transition: `opacity .7s ease ${delay}ms, transform .8s cubic-bezier(.22,1,.36,1) ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

function StickyCTA({
  scrollRef,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const pastHero = el.scrollTop > el.clientHeight * 0.75;
      // Hide once the real pre-order form scrolls into view.
      const preorder = el.querySelector<HTMLElement>("#preorder");
      let formInView = false;
      if (preorder) {
        const top = preorder.getBoundingClientRect().top - el.getBoundingClientRect().top;
        formInView = top < el.clientHeight * 0.85;
      }
      setVisible(pastHero && !formInView);
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollRef]);

  return (
    <a
      href="#preorder"
      className="mo-btn fixed bottom-5 right-5 z-50"
      style={{
        background: C.pinkDeep,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(140%)",
        pointerEvents: visible ? "auto" : "none",
        transition: "opacity .4s ease, transform .4s cubic-bezier(.34,1.56,.64,1)",
      }}
    >
      Get the book 📖
    </a>
  );
}

/* ================================================================== *
 * Hero
 * ================================================================== */

const HERO_WORDS = ["new friends", "new places", "new adventures", "big dreams"];

function ParallaxLayer({
  depth,
  pt,
  children,
}: {
  depth: number;
  pt: { x: number; y: number };
  children: ReactNode;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        transform: `translate3d(${pt.x * depth}px, ${pt.y * depth}px, 0)`,
        transition: "transform .3s ease-out",
      }}
      aria-hidden
    >
      {children}
    </div>
  );
}

function HotAirBalloon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={`pointer-events-none absolute ${className}`} style={style} viewBox="0 0 80 112" aria-hidden>
      {/* envelope gores */}
      <path d="M40 6 C18 6 8 24 8 42 C8 62 30 74 36 84 H44 C50 74 72 62 72 42 C72 24 62 6 40 6 Z" fill={C.pink} />
      <path d="M40 6 C33 24 33 66 36 84 H30 C24 70 22 30 30 12 C33 9 36 7 40 6 Z" fill={C.pinkDeep} />
      <path d="M40 6 C47 24 47 66 44 84 H50 C56 70 58 30 50 12 C47 9 44 7 40 6 Z" fill={C.purple} opacity="0.9" />
      <path d="M40 6 C36 24 36 66 40 84 C44 66 44 24 40 6 Z" fill={C.sun} />
      {/* ropes + basket */}
      <path d="M34 84 L33 96 M46 84 L47 96" stroke="#7a5a3a" strokeWidth="1.4" />
      <path d="M33 96 h14 l-1.5 10 a2 2 0 0 1-2 2 h-7 a2 2 0 0 1-2-2 z" fill="#8a5a34" />
      <rect x="33" y="95" width="14" height="3" rx="1" fill="#6e4526" />
    </svg>
  );
}

function PaperPlane({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={`pointer-events-none absolute ${className}`} style={style} viewBox="0 0 96 52" aria-hidden>
      {/* dashed flight trail */}
      <path d="M2 30 Q34 26 60 8" fill="none" stroke={C.purple} strokeWidth="2" strokeDasharray="2 6" strokeLinecap="round" opacity="0.45" />
      {/* paper plane */}
      <g transform="translate(56,0)">
        <path d="M2 16 L38 4 L20 30 L15 19 Z" fill="#ffffff" stroke={C.purple} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M15 19 L38 4 L20 30 Z" fill={C.pink} opacity="0.55" />
      </g>
    </svg>
  );
}

function Hero() {
  const headerRef = useRef<HTMLElement>(null);
  const [pt, setPt] = useState({ x: 0, y: 0 });
  const [wi, setWi] = useState(0);

  // Subtle pointer parallax (desktop + motion-OK only)
  useEffect(() => {
    if (reduceMotion()) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const el = headerRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      setPt({
        x: ((e.clientX - r.left) / r.width - 0.5) * 2,
        y: ((e.clientY - r.top) / r.height - 0.5) * 2,
      });
    };
    const onLeave = () => setPt({ x: 0, y: 0 });
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  // Rotating adventure word
  useEffect(() => {
    if (reduceMotion()) return;
    const t = setInterval(() => setWi((i) => (i + 1) % HERO_WORDS.length), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <header
      ref={headerRef}
      className="relative overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${C.skyDeep} 0%, ${C.sky} 45%, #d6f0fb 100%)`,
      }}
    >
      {/* Sun with soft glow (parallax: far) */}
      <ParallaxLayer depth={-8} pt={pt}>
        <div
          className="mo-pulse pointer-events-none absolute"
          style={{
            top: "4%",
            left: "6%",
            width: 220,
            height: 220,
            borderRadius: "9999px",
            background: `radial-gradient(circle at 50% 50%, rgba(255,240,168,0.7) 0%, rgba(255,216,77,0.25) 45%, rgba(255,216,77,0) 70%)`,
          }}
        />
        <div
          className="mo-spin pointer-events-none absolute"
          style={{
            top: "8%",
            left: "9%",
            width: 130,
            height: 130,
            borderRadius: "9999px",
            background: `radial-gradient(circle at 38% 35%, #fff6c8 0%, ${C.sun} 58%, #ffc93c 100%)`,
            boxShadow: `0 0 60px rgba(255,216,77,0.55)`,
          }}
        />
      </ParallaxLayer>

      {/* Clouds (parallax: mid) */}
      <ParallaxLayer depth={14} pt={pt}>
        <Cloud className="mo-float-slow" style={{ top: "12%", right: "10%", width: 180 }} />
        <Cloud className="mo-float" style={{ top: "30%", left: "22%", width: 120, opacity: 0.9 }} />
        <Cloud className="mo-float-slow" style={{ top: "46%", right: "26%", width: 90, opacity: 0.85 }} />
      </ParallaxLayer>

      {/* Sky traffic — balloon, plane & birds (parallax: near) */}
      <ParallaxLayer depth={24} pt={pt}>
        <HotAirBalloon className="mo-float" style={{ top: "6%", right: "7%", width: 80 }} />
        <PaperPlane className="mo-glide" style={{ top: "15%", left: "31%", width: 92 }} />
        <Bird className="mo-fly" style={{ top: "24%", width: 34 }} />
        <Bird className="mo-fly-slow" style={{ top: "31%", width: 26, opacity: 0.8 }} />
      </ParallaxLayer>

      {/* Twinkling sparkles */}
      <Sparkle className="mo-twinkle" style={{ top: "20%", left: "46%", width: 22 }} color="#fff" />
      <Sparkle className="mo-twinkle" style={{ top: "40%", right: "16%", width: 16, animationDelay: "0.8s" }} color={C.sun} />
      <Sparkle className="mo-twinkle" style={{ top: "58%", left: "40%", width: 14, animationDelay: "1.4s" }} color="#fff" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-6 pt-16 pb-44 md:grid-cols-2 md:pt-24 md:pb-60">
        {/* Copy */}
        <div className="text-center md:text-left">
          <span
            className="mo-rise inline-block rounded-full px-4 py-1.5 text-sm font-extrabold tracking-wide text-white shadow-md"
            style={{ background: C.pinkDeep, animationDelay: "0.05s" }}
          >
            ✨ A brand-new picture book
          </span>

          <h1
            className="mo-rise mt-5 leading-[0.95]"
            style={{
              fontFamily: "'Baloo 2', cursive",
              fontWeight: 800,
              animationDelay: "0.15s",
            }}
          >
            <span
              className="block text-3xl md:text-4xl"
              style={{ color: C.purple, transform: "rotate(-3deg)" }}
            >
              The Girl Called
            </span>
            <span
              className="mo-bob block text-7xl md:text-8xl"
              style={{
                color: C.pinkDeep,
                WebkitTextStroke: "2px #fff",
                textShadow: `4px 5px 0 rgba(123,78,163,0.35)`,
              }}
            >
              Mo&rsquo;
            </span>
          </h1>

          <p
            className="mo-rise mt-4 text-xl font-extrabold md:text-2xl"
            style={{ color: C.purple, fontFamily: "'Baloo 2', cursive", animationDelay: "0.22s" }}
          >
            Off to discover{" "}
            <span key={wi} className="mo-wordin inline-block" style={{ color: C.pinkDeep }}>
              {HERO_WORDS[wi]}
            </span>
            !
          </p>

          <p
            className="mo-rise mx-auto mt-3 max-w-md text-lg font-semibold md:mx-0"
            style={{ color: "#46566a", animationDelay: "0.3s" }}
          >
            Join Mo as she zips around the world — making friends, trying new
            things, and discovering that every heart holds endless dreams.
          </p>

          <div
            className="mo-rise mt-7 flex flex-wrap items-center justify-center gap-3 md:justify-start"
            style={{ animationDelay: "0.35s" }}
          >
            <a href="#preorder" className="mo-btn" style={{ background: C.pinkDeep }}>
              Get the book 📖
            </a>
            <a
              href="#peek"
              className="mo-btn"
              style={{ background: "#fff", color: C.purple, boxShadow: "0 6px 0 #d9c6e8" }}
            >
              Take a peek 👀
            </a>
          </div>

          <div
            className="mo-rise mt-5 flex items-center justify-center gap-2 md:justify-start"
            style={{ animationDelay: "0.4s" }}
          >
            <Stars size={18} />
            <span className="text-sm font-bold" style={{ color: C.purple }}>
              A new bedtime favourite for ages 2–6
            </span>
          </div>

          <p
            className="mo-rise mt-3 text-sm font-bold"
            style={{ color: C.purple, animationDelay: "0.5s" }}
          >
            Written &amp; dreamed up by <span className="underline decoration-wavy">Mo Labiyi</span>
          </p>
        </div>

        {/* Book cover image */}
        <div className="mo-rise flex justify-center" style={{ animationDelay: "0.2s" }}>
          <div
            className="relative mx-auto w-full max-w-[320px]"
            style={{
              transform: `translate3d(${pt.x * 8}px, ${pt.y * 8}px, 0)`,
              transition: "transform .3s ease-out",
            }}
          >
            <BookImagePlaceholder />
            {/* "NEW" sticker */}
            <div
              className="mo-bob absolute -right-4 -top-4 z-10 flex h-20 w-20 -rotate-12 flex-col items-center justify-center rounded-full text-white shadow-xl"
              style={{
                background: `radial-gradient(circle at 35% 30%, ${C.pink}, ${C.pinkDeep})`,
                border: "2px dashed rgba(255,255,255,0.85)",
              }}
            >
              <span className="text-lg font-extrabold leading-none" style={{ fontFamily: "'Baloo 2', cursive" }}>
                NEW
              </span>
              <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wide">
                Pre-order
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Rolling hills + pond at the bottom */}
      <svg
        className="absolute bottom-0 left-0 w-full"
        viewBox="0 0 1440 220"
        preserveAspectRatio="none"
        style={{ height: 220 }}
        aria-hidden
      >
        <path d="M0 120 C 240 60 420 150 720 110 C 1020 70 1200 150 1440 100 L1440 220 L0 220Z" fill={C.hillBack} />
        <path d="M0 165 C 260 110 500 195 760 150 C 1040 100 1240 185 1440 150 L1440 220 L0 220Z" fill={C.hillFront} />
        <ellipse cx="300" cy="210" rx="260" ry="34" fill={C.water} opacity="0.9" />
      </svg>

      {/* Flowers dotted on the hills */}
      <Flower style={{ bottom: 70, left: "12%", width: 26 }} color={C.pinkDeep} />
      <Flower style={{ bottom: 54, left: "30%", width: 20 }} color="#fff" />
      <Flower style={{ bottom: 84, right: "16%", width: 24 }} color={C.sun} />
      <Flower style={{ bottom: 58, right: "32%", width: 18 }} color={C.pinkDeep} />

      {/* Scroll-down cue */}
      <a
        href="#peek"
        aria-label="Scroll to meet Mo"
        className="mo-bounce absolute bottom-6 left-1/2 z-10 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full bg-white/90 shadow-lg"
        style={{ color: C.pinkDeep }}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </a>
    </header>
  );
}

/* ================================================================== *
 * Meet Mo
 * ================================================================== */

function MeetMo() {
  const traits: { emoji: string; word: string; tint: string }[] = [
    { emoji: "💡", word: "Bright", tint: C.sun },
    { emoji: "💛", word: "Kind", tint: C.pink },
    { emoji: "🔭", word: "Curious", tint: C.water },
    { emoji: "🤝", word: "Caring", tint: C.hillFront },
  ];

  return (
    <section id="peek" className="relative overflow-hidden px-6 py-20">
      <Butterfly className="mo-flit absolute" style={{ top: "12%", right: "10%", width: 40 }} />
      <Sparkle className="mo-twinkle absolute" style={{ top: "22%", left: "8%", width: 16 }} color={C.pink} />

      <div className="mx-auto max-w-4xl text-center">
        <Reveal>
          <Kicker>Say hello to</Kicker>
          <h2 className="mo-heading mt-2 text-5xl md:text-6xl" style={{ color: C.purple }}>
            Mo!
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold leading-relaxed" style={{ color: "#4a566a" }}>
            Mo is bright, Mo is young, and Mo is oh-so nice. She loves to learn,
            she loves to play, she loves to share, and she loves to care — and
            she&rsquo;s ready to take little readers along for the ride.
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {traits.map((t, i) => (
            <Reveal key={t.word} delay={i * 90} className="h-full">
              <div
                className="mo-card flex h-full flex-col items-center gap-2 rounded-3xl bg-white px-4 py-6"
                style={{ boxShadow: `0 10px 24px -8px ${t.tint}` }}
              >
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl"
                  style={{ background: `${t.tint}33` }}
                >
                  {t.emoji}
                </span>
                <span className="text-lg font-extrabold" style={{ color: C.purple }}>
                  {t.word}
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== *
 * Travel the world
 * ================================================================== */

function Travel() {
  const rides: { icon: ReactNode; label: string; color: string }[] = [
    { icon: <CarIcon />, label: "In a car", color: C.water },
    { icon: <TrainIcon />, label: "On a train", color: C.hillFront },
    { icon: <BoatIcon />, label: "On a boat", color: C.red },
    { icon: <PlaneIcon />, label: "On a plane", color: C.sun },
  ];

  return (
    <section
      className="relative overflow-hidden px-6 pt-24 pb-28"
      style={{ background: `linear-gradient(180deg, #d6f0fb 0%, #bfe7fa 100%)` }}
    >
      <WaveDivider color={C.cream} position="top" />
      <WaveDivider color={C.cream} position="bottom" />

      <Cloud className="mo-float-slow pointer-events-none absolute" style={{ top: "16%", left: "6%", width: 110, opacity: 0.75 }} />

      <div className="relative z-10 mx-auto max-w-5xl text-center">
        <Reveal>
          <Kicker>Adventure awaits</Kicker>
          <h2 className="mo-heading mt-2 text-4xl md:text-5xl" style={{ color: C.purple }}>
            All around the world she goes!
          </h2>
        </Reveal>

        {/* dashed travel line */}
        <div className="relative mt-14">
          <div
            className="absolute left-0 right-0 top-9 hidden border-t-4 border-dashed md:block"
            style={{ borderColor: "#ffffffcc" }}
          />
          <div className="relative grid grid-cols-2 gap-6 md:grid-cols-4">
            {rides.map((r, i) => (
              <Reveal key={r.label} delay={i * 110} className="flex justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="mo-bob flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/5"
                    style={{ outline: `4px solid ${r.color}`, outlineOffset: -2, animationDelay: `${i * 0.25}s` }}
                  >
                    <div className="mo-vehicle" style={{ color: r.color, animationDelay: `${i * 0.4}s` }}>
                      {r.icon}
                    </div>
                  </div>
                  <span className="text-lg font-extrabold" style={{ color: C.purple }}>
                    {r.label}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal delay={120}>
          <p className="mt-14 text-xl font-bold" style={{ color: C.pinkDeep }}>
            New places, new friends, new things to try on every page. 🌍
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ================================================================== *
 * Pull-quote band
 * ================================================================== */

function QuoteBand() {
  return (
    <section className="px-6 py-20" style={{ background: C.cream }}>
      <Reveal className="mx-auto max-w-4xl">
        <div
          className="relative overflow-hidden rounded-[2.5rem] px-8 py-14 text-center text-white shadow-xl"
          style={{
            background: `linear-gradient(135deg, ${C.pinkDeep} 0%, ${C.purple} 100%)`,
          }}
        >
          {/* drifting shine */}
          <div className="mo-shine pointer-events-none absolute inset-0" aria-hidden />
          {/* faint sparkles */}
          <Sparkle className="mo-twinkle absolute" style={{ top: "14%", left: "8%", width: 18 }} color="#ffffffcc" />
          <Sparkle className="mo-twinkle absolute" style={{ bottom: "16%", right: "10%", width: 14, animationDelay: "1s" }} color="#ffffffcc" />

          <div className="relative">
            <div className="text-5xl">“</div>
            <p
              className="mx-auto -mt-4 max-w-2xl text-2xl font-extrabold leading-snug md:text-3xl"
              style={{ fontFamily: "'Baloo 2', cursive" }}
            >
              She loves to learn, she loves to play, she loves to share, and she
              loves to care!
            </p>
            <p className="mt-6 text-sm font-bold uppercase tracking-widest text-white/80">
              — from The Girl Called Mo&rsquo;
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ================================================================== *
 * What's inside
 * ================================================================== */

function WhatsInside() {
  const items: { emoji: string; title: string; body: string; tint: string }[] = [
    {
      emoji: "🎨",
      title: "Bright, joyful art",
      body: "Big, colorful illustrations made to be pored over again and again.",
      tint: C.pink,
    },
    {
      emoji: "🎵",
      title: "Rhyme you'll remember",
      body: "Bouncy, read-aloud verse that's perfect for cuddly bedtime reads.",
      tint: C.water,
    },
    {
      emoji: "🌟",
      title: "A big, kind heart",
      body: "Gentle lessons about curiosity, sharing, and caring for others.",
      tint: C.sun,
    },
  ];

  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-5xl text-center">
        <Reveal>
          <Kicker>What&rsquo;s inside</Kicker>
          <h2 className="mo-heading mt-2 text-4xl md:text-5xl" style={{ color: C.purple }}>
            Made for little explorers
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {items.map((it, i) => (
            <Reveal key={it.title} delay={i * 110} className="h-full">
              <div
                className="mo-card h-full rounded-3xl bg-white p-8 text-left"
                style={{ boxShadow: `0 16px 32px -12px ${it.tint}` }}
              >
                <span
                  className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
                  style={{ background: `${it.tint}33` }}
                >
                  {it.emoji}
                </span>
                <h3 className="mt-5 text-xl font-extrabold" style={{ color: C.purple }}>
                  {it.title}
                </h3>
                <p className="mt-2 font-semibold leading-relaxed" style={{ color: "#5a6678" }}>
                  {it.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <div
            className="mx-auto mt-10 inline-flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-full bg-white px-7 py-3 text-sm font-extrabold shadow"
            style={{ color: C.purple }}
          >
            <span>👶 Ages 2–6</span>
            <span style={{ color: C.pink }}>•</span>
            <span>📖 Hardcover</span>
            <span style={{ color: C.pink }}>•</span>
            <span>🛏️ Bedtime ready</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ================================================================== *
 * Praise / Reviews
 * ================================================================== */

function Reviews() {
  // Placeholder blurbs — swap for real reviews / endorsements.
  const reviews: { quote: string; name: string; role: string; tint: string }[] = [
    {
      quote:
        "My daughter asks for ‘the Mo book’ every single night. The rhymes are a joy to read aloud and the pictures spark so many questions.",
      name: "Amara T.",
      role: "Parent of two",
      tint: C.pink,
    },
    {
      quote:
        "A warm, vibrant celebration of curiosity and kindness — perfect for sparking little imaginations at story time.",
      name: "Ms. Bello",
      role: "Early Years teacher",
      tint: C.water,
    },
    {
      quote:
        "Bright, bouncy and big-hearted. The kind of picture book that becomes an instant bedtime favourite.",
      name: "StoryNest Review",
      role: "Children’s book blog",
      tint: C.purple,
    },
  ];

  return (
    <section className="relative overflow-hidden px-6 pt-24 pb-20" style={{ background: C.lilac }}>
      <WaveDivider color={C.cream} position="top" />
      <Sparkle className="mo-twinkle absolute" style={{ top: "16%", right: "9%", width: 18 }} color={C.pink} />
      <Sparkle className="mo-twinkle absolute" style={{ bottom: "12%", left: "8%", width: 14, animationDelay: "1s" }} color={C.purple} />

      <div className="relative z-10 mx-auto max-w-5xl text-center">
        <Reveal>
          <Kicker>Praise for Mo&rsquo;</Kicker>
          <h2 className="mo-heading mt-2 text-4xl md:text-5xl" style={{ color: C.purple }}>
            Loved by little readers &amp; grown-ups alike
          </h2>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <Stars size={22} />
            <span className="text-lg font-extrabold" style={{ color: C.purple }}>
              4.9 / 5
            </span>
            <span className="font-semibold" style={{ color: "#6a5a7a" }}>
              from early readers &amp; their grown-ups
            </span>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {reviews.map((r, i) => (
            <Reveal key={r.name} delay={i * 110} className="h-full">
              <figure
                className="mo-card flex h-full flex-col rounded-3xl bg-white p-7 text-left"
                style={{ boxShadow: `0 16px 32px -12px ${r.tint}` }}
              >
                <Stars size={18} />
                <blockquote className="mt-4 flex-1 text-lg font-semibold leading-relaxed" style={{ color: "#46394f" }}>
                  &ldquo;{r.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full text-base font-extrabold text-white"
                    style={{ background: r.tint }}
                  >
                    {r.name.charAt(0)}
                  </span>
                  <span>
                    <span className="block text-sm font-extrabold" style={{ color: C.purple }}>
                      {r.name}
                    </span>
                    <span className="block text-xs font-semibold" style={{ color: "#8a7a9a" }}>
                      {r.role}
                    </span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <p className="mt-10 text-sm font-bold" style={{ color: "#8a7a9a" }}>
            Are you a reviewer or educator?{" "}
            <a href="#preorder" className="underline decoration-wavy" style={{ color: C.pinkDeep }}>
              Request a review copy
            </a>
            .
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ================================================================== *
 * Pre-order / CTA
 * ================================================================== */

function PreOrder() {
  const formats = ["Hardcover", "eBook", "Audiobook"] as const;
  const [format, setFormat] = useState<(typeof formats)[number]>("Hardcover");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <section
      id="preorder"
      className="relative overflow-hidden px-6 pt-28 pb-24"
      style={{ background: `linear-gradient(180deg, ${C.sky} 0%, ${C.skyDeep} 100%)` }}
    >
      <WaveDivider color={C.lilac} position="top" />

      <Cloud className="mo-float pointer-events-none absolute" style={{ top: "14%", left: "6%", width: 120, opacity: 0.8 }} />
      <Cloud className="mo-float-slow pointer-events-none absolute" style={{ bottom: "12%", left: "16%", width: 130, opacity: 0.8 }} />
      <Bird className="mo-fly-slow" style={{ top: "20%", width: 30, opacity: 0.85 }} />
      <Sparkle className="mo-twinkle absolute" style={{ top: "24%", right: "12%", width: 18 }} color="#fff" />

      <div className="relative z-10 mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-2">
        {/* Book cover image placeholder, grounded with a soft shadow */}
        <Reveal className="flex justify-center">
          <div className="relative">
            <BookImagePlaceholder />
            <div
              className="absolute -bottom-7 left-1/2 h-5 w-3/4 -translate-x-1/2 rounded-[100%]"
              style={{ background: "rgba(40,28,60,0.28)", filter: "blur(12px)" }}
              aria-hidden
            />
          </div>
        </Reveal>

        {/* Frosted-glass CTA card */}
        <Reveal delay={120}>
          <div className="rounded-[2rem] border border-white/40 bg-white/15 p-7 shadow-2xl backdrop-blur-md md:p-8">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-white"
              style={{ background: C.pinkDeep }}
            >
              ✨ Pre-order · Launching Autumn 2026
            </span>

            <h2
              className="mo-heading mt-4 text-4xl leading-tight md:text-5xl"
              style={{ color: "#fff", textShadow: "2px 3px 0 rgba(123,78,163,0.35)" }}
            >
              Bring Mo home today!
            </h2>
            <p className="mt-3 max-w-md font-semibold text-white/95">
              Be among the first to share Mo&rsquo;s big-hearted adventure with the
              little reader in your life.
            </p>

            {/* Format selector */}
            <div className="mt-6">
              <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-white/80">
                Choose a format
              </p>
              <div className="flex flex-wrap gap-2">
                {formats.map((f) => {
                  const active = f === format;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      aria-pressed={active}
                      className="rounded-full px-4 py-2 text-sm font-extrabold transition"
                      style={
                        active
                          ? { background: "#fff", color: C.purple, boxShadow: "0 4px 0 rgba(0,0,0,0.15)" }
                          : { background: "rgba(255,255,255,0.16)", color: "#fff", border: "1px solid rgba(255,255,255,0.5)" }
                      }
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Email capture / success */}
            {submitted ? (
              <div className="mo-pop mt-6 rounded-2xl bg-white/95 p-6 text-center">
                <span
                  className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-2xl text-white"
                  style={{ background: C.hillFront }}
                >
                  ✓
                </span>
                <p className="mt-3 text-lg font-extrabold" style={{ color: C.purple }}>
                  You&rsquo;re on the list! 🎉
                </p>
                <p className="mt-1 text-sm font-semibold" style={{ color: "#6a5a7a" }}>
                  We&rsquo;ll email you the moment Mo&rsquo; ({format}) is ready to ship.
                </p>
              </div>
            ) : (
              <>
                <form
                  className="mt-6 flex flex-col gap-3 lg:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (email.trim()) setSubmitted(true);
                  }}
                >
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="grown-up@email.com"
                    className="w-full rounded-full border-2 border-white/70 bg-white/95 px-5 py-3 font-semibold text-purple-900 shadow-inner outline-none transition placeholder:text-purple-300 focus:border-white focus:ring-4 focus:ring-white/40"
                  />
                  <button type="submit" className="mo-btn shrink-0" style={{ background: C.pinkDeep }}>
                    Notify me 🎉
                  </button>
                </form>
                <p className="mt-3 text-sm font-semibold text-white/80">
                  No spam — just a hello when Mo&rsquo; is ready to ship.
                </p>
              </>
            )}

            {/* Trust signals */}
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/25 pt-4 text-sm font-bold text-white/90">
              <span>🔒 Secure pre-order</span>
              <span>🚚 Free UK shipping</span>
              <span>↩️ 30-day returns</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ================================================================== *
 * Footer
 * ================================================================== */

function Footer() {
  return (
    <footer className="px-6 py-12 text-center" style={{ background: C.purple, color: "#fff" }}>
      <p className="text-2xl" style={{ fontFamily: "'Baloo 2', cursive" }}>
        The Girl Called Mo&rsquo;
      </p>
      <p className="mx-auto mt-3 max-w-xl text-sm font-semibold text-white/80">
        For the little dreamers — may every page you turn sparkle with adventure,
        and every story remind you that your heart holds endless dreams.
      </p>
      <p className="mt-6 text-xs font-bold uppercase tracking-widest text-white/60">
        © {new Date().getFullYear()} Mo Labiyi · Made with 💜
      </p>
    </footer>
  );
}

/* ================================================================== *
 * Small shared bits
 * ================================================================== */

function Kicker({ children }: { children: ReactNode }) {
  return (
    <span
      className="text-sm font-extrabold uppercase tracking-[0.2em]"
      style={{ color: C.pinkDeep }}
    >
      {children}
    </span>
  );
}

function Stars({ count = 5, size = 18 }: { count?: number; size?: number }) {
  return (
    <span
      className="inline-flex gap-0.5"
      role="img"
      aria-label={`${count} out of 5 stars`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={C.gold} aria-hidden>
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      ))}
    </span>
  );
}

function Cloud({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={`pointer-events-none absolute ${className}`}
      style={style}
      viewBox="0 0 200 110"
      fill={C.cloud}
      aria-hidden
    >
      <ellipse cx="60" cy="70" rx="55" ry="38" />
      <ellipse cx="110" cy="55" rx="50" ry="42" />
      <ellipse cx="150" cy="75" rx="42" ry="32" />
      <rect x="55" y="78" width="105" height="28" rx="14" />
    </svg>
  );
}

function Bird({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={`pointer-events-none absolute ${className}`}
      style={style}
      viewBox="0 0 40 16"
      fill="none"
      stroke="#5b6b8a"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M2 12 Q10 2 19 11 Q28 2 38 12" />
    </svg>
  );
}

function Sparkle({
  className = "",
  style,
  color = "#fff",
}: {
  className?: string;
  style?: React.CSSProperties;
  color?: string;
}) {
  return (
    <svg
      className={`pointer-events-none ${className}`}
      style={style}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden
    >
      <path d="M12 0 C13 7 17 11 24 12 C17 13 13 17 12 24 C11 17 7 13 0 12 C7 11 11 7 12 0 Z" />
    </svg>
  );
}

function Butterfly({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={`pointer-events-none ${className}`}
      style={style}
      viewBox="0 0 40 36"
      aria-hidden
    >
      <ellipse cx="13" cy="12" rx="11" ry="10" fill={C.pinkDeep} opacity="0.85" />
      <ellipse cx="27" cy="12" rx="11" ry="10" fill={C.purple} opacity="0.85" />
      <ellipse cx="14" cy="26" rx="8" ry="8" fill={C.pink} opacity="0.85" />
      <ellipse cx="26" cy="26" rx="8" ry="8" fill={C.water} opacity="0.85" />
      <rect x="19" y="5" width="2.5" height="28" rx="1.25" fill="#4a3a2a" />
      <circle cx="20" cy="6" r="2" fill="#4a3a2a" />
    </svg>
  );
}

function Flower({
  style,
  color,
}: {
  style?: React.CSSProperties;
  color: string;
}) {
  return (
    <svg className="pointer-events-none absolute" style={style} viewBox="0 0 24 24" aria-hidden>
      {[0, 72, 144, 216, 288].map((deg) => (
        <ellipse
          key={deg}
          cx="12"
          cy="6.5"
          rx="3.2"
          ry="5"
          fill={color}
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="3" fill={C.sun} />
    </svg>
  );
}

function WaveDivider({
  color,
  position,
}: {
  color: string;
  position: "top" | "bottom";
}) {
  const top = position === "top";
  return (
    <svg
      className="pointer-events-none absolute left-0 z-0 w-full"
      style={{
        [top ? "top" : "bottom"]: -1,
        height: 56,
        transform: top ? undefined : "scaleY(-1)",
      }}
      viewBox="0 0 1440 56"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M0 0 C 240 56 480 8 720 28 C 960 48 1200 8 1440 30 L1440 0 Z"
        fill={color}
      />
    </svg>
  );
}

/* ================================================================== *
 * Book-cover image placeholder (hero + pre-order)
 *
 * Swap the placeholder <div> below for the real cover art, e.g.:
 *   <img
 *     src="/book-cover.jpg"
 *     alt="The Girl Called Mo' book cover"
 *     className="w-full rounded-2xl"
 *     style={{ boxShadow: "0 30px 60px rgba(0,0,0,0.3)", transform: "rotate(-3deg)" }}
 *   />
 * ================================================================== */

function BookImagePlaceholder() {
  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      {/* soft glow behind the cover */}
      <div
        className="pointer-events-none absolute -inset-6 rounded-[2.5rem]"
        style={{ background: "radial-gradient(circle at 50% 45%, rgba(255,255,255,0.55), rgba(255,255,255,0) 70%)" }}
        aria-hidden
      />
      <div
        className="relative flex flex-col items-center justify-center gap-3 rounded-2xl border-4 border-dashed bg-white/75 px-6 text-center backdrop-blur-sm"
        style={{
          aspectRatio: "3 / 4",
          borderColor: `${C.purple}55`,
          boxShadow: "0 30px 60px rgba(60,44,74,0.28)",
          transform: "rotate(-3deg)",
        }}
      >
        {/* book spine accent */}
        <div
          className="absolute left-0 top-0 h-full w-2 rounded-l-xl"
          style={{ background: C.purple, opacity: 0.7 }}
          aria-hidden
        />
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke={C.purple} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.6" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
        <span className="text-base font-extrabold" style={{ color: C.purple }}>
          Book cover image
        </span>
        <span className="max-w-[180px] text-xs font-semibold" style={{ color: "#8a7a9a" }}>
          Add the cover art here (recommended 3:4 portrait)
        </span>
      </div>
    </div>
  );
}

/* ================================================================== *
 * Travel icons
 * ================================================================== */

function CarIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 40 l4-14 a6 6 0 0 1 6-4 h28 a6 6 0 0 1 6 4 l4 14" fill="currentColor" fillOpacity="0.12" />
      <rect x="6" y="40" width="52" height="12" rx="4" fill="currentColor" fillOpacity="0.12" />
      <circle cx="20" cy="52" r="5" fill="#fff" />
      <circle cx="44" cy="52" r="5" fill="#fff" />
    </svg>
  );
}

function TrainIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="14" y="12" width="36" height="34" rx="10" fill="currentColor" fillOpacity="0.12" />
      <line x1="14" y1="30" x2="50" y2="30" />
      <circle cx="24" cy="38" r="3" fill="currentColor" />
      <circle cx="40" cy="38" r="3" fill="currentColor" />
      <path d="M18 52 l-6 6 M46 52 l6 6" />
      <circle cx="22" cy="50" r="4" fill="#fff" />
      <circle cx="42" cy="50" r="4" fill="#fff" />
    </svg>
  );
}

function BoatIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 38 h44 l-6 12 a6 6 0 0 1-5 3 H21 a6 6 0 0 1-5-3 z" fill="currentColor" fillOpacity="0.12" />
      <path d="M32 12 v24 M32 16 l14 18 H32" fill="currentColor" fillOpacity="0.18" />
      <path d="M6 56 q8-6 14 0 t14 0 t14 0 t14 0" />
    </svg>
  );
}

function PlaneIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 36 L56 22 a4 4 0 0 1 3 7 L20 50 l-8-3 8-7 -10-2 z" fill="currentColor" fillOpacity="0.15" />
    </svg>
  );
}

/* ================================================================== *
 * Styles (keyframes + button) — scoped via unique class names
 * ================================================================== */

function Styles() {
  return (
    <style>{`
      .mo-heading { font-family: 'Baloo 2', cursive; font-weight: 800; }

      .mo-btn {
        display: inline-block;
        border-radius: 9999px;
        padding: 0.85rem 1.6rem;
        font-weight: 800;
        font-size: 1.05rem;
        color: #fff;
        box-shadow: 0 6px 0 rgba(0,0,0,0.18), 0 10px 20px -6px rgba(0,0,0,0.25);
        transition: transform .15s cubic-bezier(.34,1.56,.64,1), box-shadow .15s ease, filter .15s ease;
        cursor: pointer;
        border: none;
        text-decoration: none;
      }
      .mo-btn:hover { transform: translateY(-3px) scale(1.03); filter: saturate(1.1) brightness(1.03); }
      .mo-btn:active { transform: translateY(2px) scale(0.99); box-shadow: 0 2px 0 rgba(0,0,0,0.18); }

      .mo-card {
        transition: transform .25s cubic-bezier(.22,1,.36,1), box-shadow .25s ease;
      }
      .mo-card:hover { transform: translateY(-8px) rotate(-1deg) scale(1.02); }

      @keyframes moFloat {
        0%,100% { transform: translateY(0); }
        50%     { transform: translateY(-16px); }
      }
      .mo-float      { animation: moFloat 6s ease-in-out infinite; }
      .mo-float-slow { animation: moFloat 9s ease-in-out infinite; }

      @keyframes moBob {
        0%,100% { transform: translateY(0) rotate(-1deg); }
        50%     { transform: translateY(-10px) rotate(1deg); }
      }
      .mo-bob      { animation: moBob 4s ease-in-out infinite; }
      .mo-bob-slow { animation: moBob 6s ease-in-out infinite; }

      @keyframes moSpin { to { transform: rotate(360deg); } }
      .mo-spin { animation: moSpin 80s linear infinite; }

      @keyframes moPulse {
        0%,100% { transform: scale(1);   opacity: .9; }
        50%     { transform: scale(1.08); opacity: 1; }
      }
      .mo-pulse { animation: moPulse 6s ease-in-out infinite; }

      /* Mo's friendly wave — rocks the raised arm from the shoulder */
      @keyframes moWave {
        0%, 100% { transform: rotate(9deg); }
        50%      { transform: rotate(-9deg); }
      }
      .mo-wave {
        transform-box: view-box;
        transform-origin: 200px 248px;
        animation: moWave 0.9s ease-in-out infinite;
      }

      @keyframes moPop {
        0% { transform: scale(0.6); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
      }
      .mo-pop { animation: moPop .5s cubic-bezier(.34,1.56,.64,1) both; }

      /* Hero entrance */
      @keyframes moRise {
        0%   { opacity: 0; transform: translateY(26px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      .mo-rise { opacity: 0; animation: moRise .8s cubic-bezier(.22,1,.36,1) both; }

      /* Birds gliding across the sky */
      @keyframes moFly {
        0%   { transform: translateX(-12vw) translateY(0); }
        50%  { transform: translateX(50vw)  translateY(-18px); }
        100% { transform: translateX(115vw) translateY(0); }
      }
      .mo-fly      { left: 0; animation: moFly 16s linear infinite; }
      .mo-fly-slow { left: 0; animation: moFly 24s linear infinite; }

      /* Twinkling sparkles */
      @keyframes moTwinkle {
        0%,100% { transform: scale(.5) rotate(0deg);   opacity: .25; }
        50%     { transform: scale(1)  rotate(90deg);  opacity: 1; }
      }
      .mo-twinkle { animation: moTwinkle 3s ease-in-out infinite; }

      /* Butterfly fluttering along a gentle path */
      @keyframes moFlit {
        0%   { transform: translate(0,0) rotate(-6deg); }
        25%  { transform: translate(-18px,-14px) rotate(6deg); }
        50%  { transform: translate(-32px,4px) rotate(-4deg); }
        75%  { transform: translate(-14px,16px) rotate(8deg); }
        100% { transform: translate(0,0) rotate(-6deg); }
      }
      .mo-flit { animation: moFlit 9s ease-in-out infinite; }

      /* Vehicles jiggling inside their badges */
      @keyframes moVehicle {
        0%,100% { transform: translateX(-2px) rotate(-2deg); }
        50%     { transform: translateX(2px)  rotate(2deg); }
      }
      .mo-vehicle { animation: moVehicle 2.4s ease-in-out infinite; }

      /* Scroll-down cue */
      @keyframes moBounce {
        0%,100% { transform: translate(-50%, 0); }
        50%     { transform: translate(-50%, 8px); }
      }
      .mo-bounce { animation: moBounce 1.6s ease-in-out infinite; }

      /* Rotating hero word */
      @keyframes moWordIn {
        0%   { opacity: 0; transform: translateY(12px) rotate(-3deg); }
        100% { opacity: 1; transform: translateY(0) rotate(0); }
      }
      .mo-wordin { animation: moWordIn .5s cubic-bezier(.22,1,.36,1) both; }

      /* Paper plane drift */
      @keyframes moGlide {
        0%,100% { transform: translate(0,0) rotate(-4deg); }
        50%     { transform: translate(26px,-14px) rotate(3deg); }
      }
      .mo-glide { animation: moGlide 7s ease-in-out infinite; }

      /* Drifting shine over the quote panel */
      @keyframes moShine {
        0%   { transform: translateX(-120%) skewX(-18deg); }
        100% { transform: translateX(220%)  skewX(-18deg); }
      }
      .mo-shine::before {
        content: "";
        position: absolute;
        top: 0; left: 0;
        width: 40%; height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,.22), transparent);
        animation: moShine 5.5s ease-in-out infinite;
      }

      @media (prefers-reduced-motion: reduce) {
        .mo-float,.mo-float-slow,.mo-bob,.mo-bob-slow,.mo-spin,.mo-pulse,.mo-pop,
        .mo-wave,.mo-rise,.mo-fly,.mo-fly-slow,.mo-twinkle,.mo-flit,.mo-vehicle,
        .mo-bounce,.mo-wordin,.mo-glide {
          animation: none !important;
        }
        .mo-rise { opacity: 1; }
        .mo-shine::before { animation: none; display: none; }
      }
    `}</style>
  );
}
