import { Link } from 'react-router-dom'
import FoodCard from '../components/FoodCard'
import { ArrowIcon, ClockIcon, PhoneIcon, PinIcon, Photo, Reveal, SectionTitle, Star } from '../components/ui'
import { naira, TBC } from '../data'
import { featuredOf, useBranchMenu } from '../live'
import { useParallax, useTilt } from '../hooks'
import { useStore } from '../store'

const marquee = ['Mandi', 'Kabuli', 'BBQ Chicken', 'Pepper Soup', 'Arabic Chicken', 'Fresh Juices', 'Mojitos', 'Milk Tea', 'Fatayer', 'Samosa']

function Hero() {
  const bg = useParallax<HTMLDivElement>(0.18)
  const arch = useParallax<HTMLDivElement>(0.07)
  const chips = useParallax<HTMLDivElement>(-0.05)
  const tilt = useTilt<HTMLDivElement>(5)
  const { menu: zoo } = useBranchMenu('zoo-road')
  const all = zoo?.categories.flatMap((c) => c.items) ?? []
  const mandi = all.find((i) => i.slug === 'mandi-chicken')
  const juice = all.find((i) => i.slug === 'banana-juice')
  return (
    <section className="relative isolate overflow-hidden bg-ink text-ivory">
      <div ref={bg} className="parallax pattern-light absolute -inset-x-10 -top-20 bottom-0 -z-10 opacity-90" />
      <div className="absolute -right-40 top-10 -z-10 h-[34rem] w-[34rem] rounded-full bg-brand/30 blur-[110px]" />
      <div className="mx-auto grid min-h-[100svh] max-w-7xl items-center gap-10 px-5 pb-16 pt-32 md:px-8 lg:grid-cols-2">
        <div>
          <Reveal>
            <p className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-mint">
              <Star size={14} /> Yemeni · Arabic · Middle Eastern
            </p>
          </Reveal>
          <Reveal delay={120}>
            <h1 className="font-display text-6xl font-semibold leading-[0.95] md:text-8xl">
              A table set <em className="font-medium text-mint">Arabian</em> style, in Kano.
            </h1>
          </Reveal>
          <Reveal delay={260}>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-sand/85">
              Mandi, Kabuli, BBQ chicken, fish, soups and fresh juices. Choose your branch, build your order and enjoy.
            </p>
          </Reveal>
          <Reveal delay={400} className="mt-9 flex flex-wrap gap-3">
            <Link to="/menu" className="btn btn-ghost-light">Explore Our Menu</Link>
            <Link to="/menu" className="btn btn-primary">Order Now <ArrowIcon className="h-4 w-4" /></Link>
          </Reveal>
        </div>

        <Reveal variant="zoom" delay={250} className="relative mx-auto w-full max-w-md">
          <div ref={arch} className="parallax">
            <div ref={tilt} className="tilt">
              <Photo
                label="Rashko signature dish"
                seed={0}
                src="/images/hero.jpg"
                className="aspect-[3/4] rounded-t-[999px] rounded-b-3xl border-[6px] border-mint/70"
              />
            </div>
          </div>
          <div ref={chips} className="parallax pointer-events-none absolute inset-0">
            {mandi && (
              <div className="float absolute -left-4 top-24 rounded-2xl bg-ivory px-4 py-3 text-ink shadow-xl md:-left-12">
                <p className="font-display text-xl font-semibold">{mandi.name}</p>
                <p className="text-sm font-bold text-brand-dark">{mandi.price !== null && naira(mandi.price)}</p>
              </div>
            )}
            {juice && (
              <div className="float slow absolute -right-3 bottom-28 rounded-2xl bg-ivory px-4 py-3 text-ink shadow-xl md:-right-10">
                <p className="font-display text-xl font-semibold">{juice.name}</p>
                <p className="text-sm font-bold text-brand-dark">{juice.price !== null && naira(juice.price)}</p>
              </div>
            )}
          </div>
        </Reveal>
      </div>
      <p className="pb-6 text-center text-[0.7rem] uppercase tracking-[0.25em] text-sand/50">
        Hero photography goes here once supplied
      </p>
    </section>
  )
}

function Marquee() {
  const row = [...marquee, ...marquee]
  return (
    <div className="overflow-hidden bg-brand py-4 text-ivory" aria-hidden="true">
      <div className="marquee">
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0 items-center">
            {row.map((w, i) => (
              <span key={`${k}-${i}`} className="flex items-center font-display text-2xl font-semibold uppercase tracking-[0.12em]">
                <span className="px-6">{w}</span>
                <Star size={16} className="text-sand" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function Featured() {
  const { branch, openPicker } = useStore()
  const previewing = !branch
  const { menu } = useBranchMenu(branch?.slug ?? 'zoo-road')
  const items = featuredOf(menu)
  return (
    <section className="mx-auto max-w-7xl px-5 py-24 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <Reveal>
          <SectionTitle eyebrow="Popular dishes" title="Crowd favourites">
            {previewing
              ? 'Showing Zoo Road prices as a preview. Choose a branch to see and order at its prices.'
              : `Prices shown are for the ${branch.name} branch.`}
          </SectionTitle>
        </Reveal>
        <Reveal delay={150}>
          <button type="button" onClick={openPicker} className="btn btn-ghost">
            <PinIcon className="h-4 w-4" /> {branch ? `Ordering from ${branch.name}` : 'Choose your branch'}
          </button>
        </Reveal>
      </div>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <Reveal key={it.id} delay={(i % 3) * 110} className="h-full">
            <FoodCard item={it} seed={i} orderable={!previewing} priceLabel={previewing ? 'Zoo Road price' : undefined} />
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-12 text-center">
        <Link to="/menu" className="btn btn-dark">See the full menu <ArrowIcon className="h-4 w-4" /></Link>
      </Reveal>
    </section>
  )
}

function Experience() {
  const cards = [
    { t: 'Rice dishes', d: 'Mandi, Kabuli, Mix and Homus with chicken or meat.' },
    { t: 'Grill & fish', d: 'BBQ, Arabic and KFC-style chicken, plus fish in three sizes.' },
    { t: 'Juices & tea', d: 'Banana, avocado, zobo, mojitos, shakes and milk tea.' },
  ]
  return (
    <section className="pattern relative bg-cream py-24">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal>
          <SectionTitle eyebrow="The Rashko table" title="Come hungry, leave happy">
            Yemeni, Arabic and Middle Eastern cooking, served for dine-in, drive-through and delivery at our Zoo Road branch (please confirm availability with the branch).
          </SectionTitle>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {cards.map((c, i) => (
            <Reveal key={c.t} delay={i * 130}>
              <div className="h-full rounded-3xl bg-ivory p-8 transition duration-500 hover:-translate-y-2 hover:shadow-[0_28px_50px_-28px_rgb(12_46_32/0.5)]">
                <Star size={34} className="text-brand-dark" />
                <h3 className="mt-5 font-display text-3xl font-semibold">{c.t}</h3>
                <p className="mt-2 leading-relaxed text-moss/80">{c.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function GalleryPreview() {
  const tiles = ['Food', 'Dining room', 'Drinks', 'Entrance']
  return (
    <section className="mx-auto max-w-7xl px-5 py-24 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <Reveal><SectionTitle eyebrow="Gallery" title="A taste of the room" /></Reveal>
        <Reveal><Link to="/gallery" className="btn btn-ghost">Open gallery <ArrowIcon className="h-4 w-4" /></Link></Reveal>
      </div>
      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        {tiles.map((t, i) => (
          <Reveal key={t} delay={i * 90} variant="zoom">
            <Photo label={t} seed={i + 1} src={`/images/gallery/${i + 1}.jpg`} className={`rounded-3xl ${i % 2 ? 'aspect-[3/4]' : 'aspect-square'}`} />
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function BranchesBlock() {
  const { chooseBranch, branches } = useStore()
  return (
    <section className="bg-ink py-24 text-ivory">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal><SectionTitle light eyebrow="Branches" title="Find your Rashko" /></Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {branches?.map((b, i) => (
            <Reveal key={b.slug} delay={i * 120} className="h-full">
              <div className="flex h-full flex-col rounded-3xl border border-sand/15 bg-moss/40 p-7">
                <h3 className="font-display text-3xl font-semibold">{b.name}</h3>
                <ul className="mt-4 flex-1 space-y-3 text-sm text-sand/85">
                  <li className="flex gap-2.5"><PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-mint" />{b.address ?? `Address: ${TBC.toLowerCase()}`}</li>
                  <li className="flex gap-2.5"><PhoneIcon className="mt-0.5 h-4 w-4 shrink-0 text-mint" />{b.phone ?? `Phone: ${TBC.toLowerCase()}`}</li>
                  <li className="flex gap-2.5"><ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-mint" />{b.hours ?? `Hours: ${TBC.toLowerCase()}`}</li>
                </ul>
                {b.hasMenu ? (
                  <Link to="/menu" onClick={() => chooseBranch(b.slug)} className="btn btn-primary mt-6">Order from {b.name}</Link>
                ) : (
                  <span className="mt-6 rounded-full bg-sand/15 px-4 py-3 text-center text-sm font-semibold">Menu coming soon</span>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

import { usePageTitle } from '../meta'

export default function Home() {
  usePageTitle(null)
  return (
    <>
      <Hero />
      <Marquee />
      <Featured />
      <Experience />
      <GalleryPreview />
      <BranchesBlock />
    </>
  )
}
