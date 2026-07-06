import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BackgroundCircles } from "./ui/background-circles";

const SPLASH_DURATION_MS = 2000;

/**
 * Shows the animated splash once on app boot, then fades into `children`
 * (the gallery home page) after {@link SPLASH_DURATION_MS}.
 */
export function LoadingGate({ children }: { children: ReactNode }) {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), SPLASH_DURATION_MS);
        return () => clearTimeout(timer);
    }, []);

    return (
        <>
            {children}
            <AnimatePresence>
                {loading && (
                    <motion.div
                        className="fixed inset-0 z-[100]"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6, ease: "easeInOut" }}
                    >
                        <BackgroundCircles
                            title="UX Markets"
                            description="Mark, Atib & Juho"
                            variant="senary"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
