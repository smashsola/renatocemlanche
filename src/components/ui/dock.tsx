"use client";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion, AnimatePresence, type MotionValue, type SpringOptions } from 'framer-motion';
import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
const DEFAULT_SPRING: SpringOptions = { mass: .1, stiffness: 150, damping: 12 };
const DockContext = createContext<{ mouseX: MotionValue<number>; distance: number; magnification: number; baseWidth: number; spring: SpringOptions } | null>(null);
function useDock() { const value = useContext(DockContext); if (!value) throw new Error('DockItem requires Dock'); return value; }
export function Dock({ children, className, distance = 95, magnification = 88, spring = DEFAULT_SPRING, panel = true, baseWidth = 64 }: { children: ReactNode; className?: string; distance?: number; magnification?: number; spring?: SpringOptions; panel?: boolean; baseWidth?: number }) {
  const mouseX = useMotionValue(Infinity);
  return <motion.div className={cn('flex items-end px-3 py-1.5 max-[760px]:px-1', panel && 'rounded-2xl border border-white/10 bg-[#191915]', className)} onPointerMove={event => mouseX.set(event.clientX)} onPointerDown={event => mouseX.set(event.clientX)} onPointerUp={event => { if (event.pointerType === 'touch') mouseX.set(Infinity); }} onPointerCancel={() => mouseX.set(Infinity)} onPointerLeave={() => mouseX.set(Infinity)}>
    <DockContext.Provider value={{ mouseX, distance, magnification, spring, baseWidth }}>{children}</DockContext.Provider>
  </motion.div>;
}
const ItemContext = createContext<{ width: MotionValue<number>; hovered: boolean; active: boolean } | null>(null);
export function DockItem({ children, href, label, active = false, uniform = false }: { children: ReactNode; href: string; label: string; active?: boolean; uniform?: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const { mouseX, distance, magnification, spring, baseWidth } = useDock();
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const delta = useTransform(mouseX, x => { const rect = ref.current?.getBoundingClientRect(); return rect ? x - rect.left - rect.width / 2 : Infinity; });
  const target = useTransform(delta, [-distance, 0, distance], [baseWidth, reduced ? magnification - 6 : magnification, baseWidth]);
  const width = useSpring(target, spring);
  const lift = useTransform(width, [baseWidth, magnification], [0, -7]);
  return <motion.a ref={ref} href={href} target={href.startsWith("https:") ? "_blank" : undefined} rel={href.startsWith("https:") ? "noopener noreferrer" : undefined} aria-label={label} className={cn("relative flex h-[62px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl text-[#f7f1df] no-underline hover:bg-[#f9c71920] hover:text-[#f9c719] focus-visible:outline-2 focus-visible:outline-[#f9c719]", active && "text-[#f9c719]")} aria-current={active ? "location" : undefined} whileTap={{ scale: .9 }} transition={{ type: "spring", stiffness: 350, damping: 20 }} style={{ width: uniform ? undefined : width, y: lift }} onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)} onFocus={() => setHovered(true)} onBlur={() => setHovered(false)}>
    {active && <motion.span layoutId="mobile-dock-active" className="absolute inset-0 rounded-xl border border-[#f9c71930] bg-[#f9c71915]" transition={{ type: "spring", stiffness: 340, damping: 28 }} />}
    <ItemContext.Provider value={{ width, hovered, active }}><span className="relative flex flex-col items-center gap-1.5">{children}</span></ItemContext.Provider>
  </motion.a>;
}
export function DockIcon({ children, fixed = false }: { children: ReactNode; fixed?: boolean }) {
  const context = useContext(ItemContext)!;
  const scale = useTransform(context.width, value => 1 + Math.max(0, value - 64) / 96);
  return <motion.span animate={{ y: fixed ? 0 : context.active ? -3 : 0, scale: fixed ? 1 : context.active ? 1.15 : 1 }} transition={{ type: "spring", stiffness: 320, damping: 18 }} className="flex shrink-0 items-center justify-center [&>svg]:h-full [&>svg]:w-full [&>svg]:stroke-[2]" style={{ width: 26, height: 26, scale: fixed ? 1 : scale }}>{children}</motion.span>;
}
export function DockLabel({ children }: { children: ReactNode }) {
  const { hovered } = useContext(ItemContext)!;
  const reduced = useReducedMotion();
  return <><span className="whitespace-nowrap text-[11px] font-bold max-[760px]:whitespace-normal max-[760px]:text-center max-[760px]:text-[9px] max-[760px]:leading-tight">{children}</span><AnimatePresence>{hovered && <motion.span aria-hidden="true" className="max-[760px]:hidden pointer-events-none absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#f9c719] px-2 py-1 text-[11px] font-bold text-[#0b0b09]" initial={{ opacity: 0, y: reduced ? 0 : 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .16 }}>{children}</motion.span>}</AnimatePresence></>;
}
