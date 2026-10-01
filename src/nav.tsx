import { motion, animate } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Home, Utensils, MapPin, Flame } from 'lucide-react';
import { Dock, DockItem, DockIcon, DockLabel } from './components/ui/dock';
function Instagram({ 'aria-hidden': hidden }: { 'aria-hidden'?: boolean }) { return <svg aria-hidden={hidden} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/></svg>; }
function WhatsApp({ 'aria-hidden': hidden }: { 'aria-hidden'?: boolean }) { return <svg aria-hidden={hidden} className="whatsapp-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none" shapeRendering="geometricPrecision"><path d="M20.52 3.48A11.92 11.92 0 0 0 12.02 0C5.4 0 .02 5.37.02 12c0 2.12.55 4.19 1.6 6.02L0 24l6.14-1.61A11.97 11.97 0 0 0 12.02 24C18.65 24 24 18.63 24 12c0-3.2-1.24-6.2-3.48-8.52ZM12.02 21.98a9.98 9.98 0 0 1-5.09-1.39l-.36-.21-3.65.96.98-3.56-.24-.37A9.98 9.98 0 0 1 2.02 12c0-5.51 4.48-9.98 10-9.98A9.98 9.98 0 0 1 22 12c0 5.51-4.47 9.98-9.98 9.98Zm5.47-7.47c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.8-1.49-1.78-1.66-2.08-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.5 0 1.47 1.07 2.9 1.22 3.1.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.69.62.71.22 1.36.19 1.87.11.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.18-1.42-.08-.12-.28-.2-.58-.35Z"/></svg>; }
const data = [
  { label: 'Início', href: '#inicio', Icon: Home },
  { label: 'Mais pedidos', href: '#mais-pedidos', Icon: Flame },
  { label: 'Cardápio', href: '#cardapio', Icon: Utensils },
  { label: 'Localização', href: '#localizacao', Icon: MapPin },
  { label: 'WhatsApp', href: 'https://wa.me/5588994537456', Icon: WhatsApp },
  { label: 'Instagram', href: 'https://www.instagram.com/renatolanchesbetania/', Icon: Instagram },
];
function Navigation({ mobile = false }: { mobile?: boolean }) {
  const [current, setCurrent] = useState('#inicio');
  useEffect(() => {
    if (!mobile) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      let selected = '#inicio';
      let closestTop = -Infinity;
      for (const item of data) {
        const section = item.href.startsWith('#') ? document.querySelector(item.href) : null;
        if (section) { const top = section.getBoundingClientRect().top; if (top <= innerHeight * .35 && top > closestTop) { selected = item.href; closestTop = top; } }
      }
      setCurrent(selected);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule);
    return () => { removeEventListener('scroll', schedule); removeEventListener('resize', schedule); cancelAnimationFrame(frame); };
  }, [mobile]);
  return <Dock panel={mobile} className={mobile ? 'w-full justify-between gap-0 shadow-lg py-2' : 'gap-3'} baseWidth={mobile ? 44 : 64} distance={mobile ? 45 : 95} magnification={mobile ? 62 : 88}>{data.filter((_, index) => mobile || index > 0).map(({label, href, Icon}) => <DockItem uniform={mobile} key={href} href={href} label={label} active={mobile && current === href}><DockIcon fixed={mobile || label === 'WhatsApp'}><Icon aria-hidden={true} /></DockIcon><DockLabel>{mobile && label === 'Localização' ? 'Local' : mobile && label === 'Mais pedidos' ? 'Favoritos' : label}</DockLabel></DockItem>)}</Dock>;
}
const desktop = document.querySelector('.header nav');
if (desktop) createRoot(desktop).render(<Navigation />);
const mobile = document.querySelector('.mobile-react-nav');
if (mobile) createRoot(mobile).render(<Navigation mobile />);

const brand = document.querySelector('.header .brand');
if (brand) createRoot(brand).render(<motion.div className="inline-flex flex-col" whileHover={{ y: -4, scale: 1.07, rotate: -2 }} whileTap={{ scale: .94 }} transition={{ type: 'spring', stiffness: 260, damping: 17 }}><span>RENATO<span className="brand-mark">100%</span></span><small>LANCHES</small></motion.div>);
const header = document.querySelector<HTMLElement>('.header');
if (header) {
  const followFinger = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;
    const rect = header.getBoundingClientRect();
    const position = Math.max(-1, Math.min(1, (touch.clientX - rect.left) / rect.width * 2 - 1));
    animate(header, { rotate: position * 1.8, x: position * 3, y: -4, scale: 1 }, { duration: .1 });
  };
  const release = () => animate(header, { rotate: 0, x: 0, y: 0, scale: 1 }, { type: 'spring', stiffness: 240, damping: 16 });
  header.addEventListener('touchstart', followFinger, { passive: true });
  header.addEventListener('touchmove', followFinger, { passive: true });
  header.addEventListener('touchend', release);
  header.addEventListener('touchcancel', release);
}
document.addEventListener('pointerdown', event => {
  const button = (event.target as HTMLElement).closest<HTMLElement>('button, .button');
  if (button && !button.hasAttribute('disabled')) animate(button, { scale: .96, y: 1 }, { duration: .1 });
});
for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, () => {
  document.querySelectorAll<HTMLElement>('button, .button').forEach(button => { if (button.style.transform) animate(button, { scale: 1, y: 0 }, { type: 'spring', stiffness: 350, damping: 18 }); });
});
const entered = new WeakSet<Element>();
const entrance = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    if (!entered.has(entry.target)) {
      entered.add(entry.target);
      animate(entry.target as HTMLElement, { opacity: [.8, 1], y: [10, 0] }, { duration: .38, ease: [0.2, .8, .25, 1] });
    }
    entrance.unobserve(entry.target);
  }
}, { threshold: .08 });
function watchCards() { document.querySelectorAll('.favorite-card, #products .product').forEach(card => { if (!entered.has(card)) entrance.observe(card); }); }
watchCards();
const cardChanges = new MutationObserver(watchCards);
for (const id of ['products', 'popular-products']) { const root = document.getElementById(id); if (root) cardChanges.observe(root, { childList: true }); }

const footer = document.querySelector('footer');
if (footer) createRoot(footer).render(<motion.div className="footer-content" initial={{ opacity: .75, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .2 }} transition={{ duration: .5, ease: [.2, .8, .25, 1] }}>
  <motion.a className="brand" href="#inicio" aria-label="Renato 100% Lanches, voltar ao início" whileHover={{ y: -3 }} whileTap={{ scale: .96 }}><span>RENATO<span className="brand-mark">100%</span></span><small>LANCHES</small></motion.a>
  <p>Feito na hora. Feito no capricho.</p>
  <div className="footer-socials"><motion.a href="https://wa.me/5588994537456" target="_blank" rel="noopener noreferrer" whileHover={{ y: -3 }} whileTap={{ scale: .95 }}><WhatsApp aria-hidden={true}/>WhatsApp</motion.a><motion.a href="https://www.instagram.com/renatolanchesbetania/" target="_blank" rel="noopener noreferrer" whileHover={{ y: -3 }} whileTap={{ scale: .95 }}><Instagram aria-hidden={true}/>Instagram</motion.a></div>
</motion.div>);

