import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowDown, ArrowRight, Wheat, ShieldCheck, Truck, Plus } from 'lucide-react';
import { Product } from '../types';
import { ScrollMillingStory } from './GrainStory';

gsap.registerPlugin(ScrollTrigger);

type Props = {
  products: Product[];
  popular: Product[];
  onShop: (category?: string) => void;
  onCategories: () => void;
  onProduct: (product: Product) => void;
  onAdd: (product: Product, event: React.MouseEvent) => void;
  children: React.ReactNode;
};

const collections = [
  { id: 'flour', name: 'Atta & Flour', detail: 'Slow stone-ground. Wholly wholesome.', image: 'flour' },
  { id: 'rice', name: 'Premium Rice', detail: 'Aromatic Basmati, aged to perfection.', image: 'rice' },
  { id: 'lentils', name: 'Daal & Lentils', detail: 'Clean, nourishing everyday essentials.', image: 'spices' },
];

export function EditorialHome({ products, popular, onShop, onCategories, onProduct, onAdd, children }: Props) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = gsap.matchMedia();
    const context = gsap.context(() => {
      media.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.editorial-hero .entrance', { y: 22, opacity: 0, stagger: 0.09, duration: 0.85, ease: 'power2.out', clearProps: 'all' });
        gsap.to('.hero-photo img', { yPercent: 7, scale: 1.08, ease: 'none', scrollTrigger: { trigger: '.editorial-hero', start: 'top top', end: 'bottom top', scrub: 0.8 } });
        gsap.utils.toArray<HTMLElement>('[data-reveal]', root.current!).forEach(element => {
          gsap.from(element, { y: 24, opacity: 0, duration: 0.7, ease: 'power2.out', scrollTrigger: { trigger: element, start: 'top 92%', once: true }, clearProps: 'all' });
        });
      });
    }, root);
    return () => { media.revert(); context.revert(); };
  }, []);

  function productRow(items: Product[], title: string, subtitle: string, dark = false) {
    if (!items.length) return null;
    return <section className={`provisions-section ${dark ? 'provisions-dark' : ''}`}>
      <div className="editorial-wrap">
        <div className="section-heading" data-reveal><div><span className="eyebrow">THE EVERYDAY, MADE EXCEPTIONAL</span><h2>{title}</h2><p>{subtitle}</p></div><a href="?tab=shop" onClick={e => { e.preventDefault(); onShop(); }} className="text-link">Explore the store <ArrowRight size={17} /></a></div>
        <div className="provisions-grid">{items.slice(0, 4).map(product => <article className="provision" key={product.id}>
          <a className="provision-image" href={`?product=${encodeURIComponent(product.id)}`} onClick={e => { e.preventDefault(); onProduct(product); }}>
            <img src={product.productImage || product.img || '/images/flour.webp'} alt={product.name} loading="lazy" width="480" height="480" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/images/flour.webp'; }} />
            <span>{product.badge || 'SELECTED WITH CARE'}</span><span className="product-view"><ArrowRight size={22} /></span>
          </a>
          <div className="provision-info"><div><h3><a href={`?product=${encodeURIComponent(product.id)}`} onClick={e => { e.preventDefault(); onProduct(product); }}>{product.name}</a></h3><p>Rs. {product.price.toLocaleString('en-PK')} <span>/ {product.unit}</span></p></div><button disabled={product.outOfStock} aria-label={`Add ${product.name} to basket`} onClick={e => onAdd(product, e)}><Plus size={20} /></button></div>
        </article>)}</div>
      </div>
    </section>;
  }

  return <div ref={root} className="editorial-home">
    <section className="editorial-hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <span className="eyebrow entrance"><span className="eyebrow-line" /> EST. 1994 · PURE FLOUR MILLING</span>
        <h1 id="hero-title" className="entrance">Natural<br />Stone-Grounded<br /><em>Fresh Chakki Atta.</em></h1>
        <p className="hero-description entrance">Discover raw flour purity at Babay Dee Atta Chakki. We source high-grade local grains and grind them under slow stone pressure at low temperatures.</p>
        <div className="hero-actions entrance"><a id="hero-shop-now-btn" href="?tab=shop" className="editorial-button" onClick={e => { e.preventDefault(); onShop(); }}>Shop Now <ArrowRight size={18} /></a><a id="hero-categories-btn" href="?tab=categories" className="text-link" onClick={e => { e.preventDefault(); onCategories(); }}>Browse Categories <ArrowRight size={17} /></a></div>
        <div className="hero-proof entrance"><Wheat size={27} strokeWidth={1} /><p>Certified zero preservatives, zero bleach, zero additives.<br /><span>Wholesome organic nourishment. Straight to your home.</span></p></div>
      </div>
      <div className="hero-art entrance">
        <div className="hero-photo"><img src="/images/flour.webp" srcSet="/images/flour-small.webp 640w, /images/flour.webp 1280w" sizes="(max-width: 760px) 100vw, 50vw" width="1280" height="853" fetchPriority="high" alt="Fresh stone-ground flour in a wooden bowl surrounded by golden wheat" /></div>
        <div className="heritage-seal"><span>TRADITIONALLY MILLED</span><Wheat size={34} strokeWidth={1} /><span>PURE BY NATURE</span></div>
        <div className="photo-caption"><span>01 / THE ORIGINAL GOODNESS</span><span>From our chakki, with care.</span></div>
      </div>
      <a href="#our-collections" className="hero-scroll"><ArrowDown size={15} /> A little goodness, further down</a>
    </section>
    <div className="promise-strip"><span><Wheat /> Freshly stone-ground</span><span><ShieldCheck /> 100% pure & natural</span><span><Truck /> Rawalpindi & Islamabad</span><span className="promise-legacy">Three decades of trust. Every single day.</span></div>
    <section id="our-collections" className="collections-section editorial-wrap">
      <div className="section-heading" data-reveal><div><span className="eyebrow">GOOD FOOD STARTS WITH GOOD INGREDIENTS</span><h2>Everyday essentials.<br /><em>Extraordinary care.</em></h2></div><div className="section-aside"><p>Pure flours, premium rice, wholesome lentils, dry fruits, and natural herbs. Your pantry, thoughtfully sourced.</p><a href="?tab=categories" onClick={e => { e.preventDefault(); onCategories(); }} className="text-link">Browse Categories <ArrowRight size={17} /></a></div></div>
      <div className="collection-grid">{collections.map((collection, index) => <a data-reveal className="collection-card" key={collection.id} href={`?tab=shop&category=${collection.id}`} onClick={e => { e.preventDefault(); onShop(collection.id); }}><div className="collection-photo"><img src={`/images/${collection.image}.webp`} alt={collection.name} loading="lazy" width="640" height="480" /><span className="collection-number">0{index + 1}</span></div><div className="collection-label"><div><h3>{collection.name}</h3><p>{collection.detail}</p></div><ArrowRight size={22} strokeWidth={1.3} /></div></a>)}</div>
      <div className="collection-foot"><span>Also in our pantry</span><a href="?tab=shop&category=dry_fruits" onClick={e => { e.preventDefault(); onShop('dry_fruits'); }}>Premium Dry Fruits ↗</a><a href="?tab=shop&category=herbs" onClick={e => { e.preventDefault(); onShop('herbs'); }}>Herbs & Special Items ↗</a></div>
    </section>
    <ScrollMillingStory />
    {productRow(products, 'Freshly Sourced Products', 'Slow stone-ground whole wheat flours, fresh granaries & wholesome daliyas')}
    {children}
    {productRow(popular, 'Popular In Your Area', 'Top rated flour & daal choices preferred by households in Rawalpindi & Islamabad', true)}
    <section className="editorial-invitation editorial-wrap" data-reveal><Wheat size={36} strokeWidth={1} /><span className="eyebrow">FROM OUR FAMILY TO YOURS</span><h2>Goodness you can taste.<br /><em>Tradition you can trust.</em></h2><a href="?tab=shop" className="editorial-button" onClick={e => { e.preventDefault(); onShop(); }}>Bring goodness home <ArrowRight size={18} /></a></section>
  </div>;
}
