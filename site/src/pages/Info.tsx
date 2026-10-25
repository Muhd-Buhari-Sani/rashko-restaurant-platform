import { Link } from 'react-router-dom'
import { ClockIcon, PhoneIcon, PinIcon, Photo, Reveal, SectionTitle, Star } from '../components/ui'
import { TBC } from '../data'
import { useStore } from '../store'

function PageHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: string }) {
  return (
    <section className="pattern-light bg-ink px-5 pb-16 pt-36 text-ivory md:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionTitle light eyebrow={eyebrow} title={title}>{children}</SectionTitle>
      </div>
    </section>
  )
}

export function About() {
  return (
    <>
      <PageHead eyebrow="Our story" title="Yemeni and Arabian cooking, Kano hospitality">
        Rashko serves Yemeni, Arabic and Middle Eastern dishes across its Kano branches.
      </PageHead>
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 md:grid-cols-2 md:px-8">
        <Reveal variant="left"><Photo label="Rashko dining room" seed={2} src="/images/about.jpg" className="aspect-[4/5] rounded-t-[999px] rounded-b-3xl" /></Reveal>
        <Reveal variant="right">
          <h2 className="font-display text-4xl font-semibold md:text-5xl">What we serve</h2>
          <p className="mt-5 text-lg leading-relaxed text-moss/85">
            The menu centres on rice dishes such as Mandi and Kabuli, grilled and Arabic-style chicken, fish, pepper soup, and small bites like fatayer and samosa, alongside fresh juices, mojitos and tea.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-moss/85">
            Our full history, founding story and team will be added here once the restaurant shares them, so everything you read on this page is true.
          </p>
          <Link to="/menu" className="btn btn-primary mt-8">See the menu</Link>
        </Reveal>
      </div>
    </>
  )
}

export function Gallery() {
  const tiles = ['Signature dish', 'Mandi', 'Dining room', 'Fresh juices', 'Exterior', 'Grill', 'Tea', 'Appetizers', 'Seating']
  return (
    <>
      <PageHead eyebrow="Gallery" title="The Rashko experience">
        Real photography of our food and dining rooms is on its way. These tiles hold the places where it will appear.
      </PageHead>
      <div className="mx-auto max-w-7xl columns-2 gap-4 px-5 py-16 md:columns-3 md:px-8">
        {tiles.map((t, i) => (
          <Reveal key={t} delay={(i % 3) * 80} variant="zoom" className="mb-4 break-inside-avoid">
            <Photo label={t} seed={i} src={`/images/gallery/${i + 1}.jpg`} className={`rounded-3xl ${[ 'aspect-square', 'aspect-[3/4]', 'aspect-[4/3]'][i % 3]}`} />
          </Reveal>
        ))}
      </div>
    </>
  )
}

export function Branches() {
  const { chooseBranch, branch, branches, branchesError } = useStore()
  if (branchesError) {
    return (
      <>
        <PageHead eyebrow="Branches" title="Find a Rashko near you" />
        <p className="mx-auto max-w-2xl px-5 py-16 text-center text-moss/75">{branchesError}</p>
      </>
    )
  }
  if (!branches) {
    return (
      <>
        <PageHead eyebrow="Branches" title="Find a Rashko near you" />
        <p className="mx-auto max-w-2xl px-5 py-16 text-center text-moss/70">Loading branches…</p>
      </>
    )
  }
  return (
    <>
      <PageHead eyebrow="Branches" title="Find a Rashko near you">
        Details are shown only once confirmed. Where something is not yet verified, we say so.
      </PageHead>
      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-16 md:grid-cols-3 md:px-8">
        {branches.map((b, i) => (
          <Reveal key={b.slug} delay={i * 120} className="h-full">
            <article className="flex h-full flex-col rounded-3xl bg-cream p-7">
              <h2 className="font-display text-4xl font-semibold">{b.name}</h2>
              <ul className="mt-5 flex-1 space-y-3.5">
                <li className="flex gap-3"><PinIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-dark" /><span>{b.address ?? TBC}</span></li>
                <li className="flex gap-3"><PhoneIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-dark" />
                  {b.phone ? <a href={`tel:${b.phone.replace(/\s/g, '')}`} className="font-semibold hover:text-brand-dark">{b.phone}</a> : <span>{TBC}</span>}
                </li>
                <li className="flex gap-3"><ClockIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-dark" /><span>{b.hours ?? TBC}</span></li>
              </ul>
              {b.services && (
                <div className="mt-5">
                  <div className="flex flex-wrap gap-2">
                    {b.services.map((s) => <span key={s} className="rounded-full bg-ivory px-3 py-1 text-xs font-semibold">{s}</span>)}
                  </div>
                  {b.servicesNote && <p className="mt-2 text-xs text-moss/70">{b.servicesNote}</p>}
                </div>
              )}
              {b.hasMenu ? (
                <Link to="/menu" onClick={() => chooseBranch(b.slug)} className="btn btn-primary mt-7">
                  {branch?.slug === b.slug ? 'Continue ordering' : 'Order from this branch'}
                </Link>
              ) : (
                <span className="mt-7 rounded-full bg-sand px-4 py-3 text-center text-sm font-semibold">Menu coming soon</span>
              )}
            </article>
          </Reveal>
        ))}
      </div>
    </>
  )
}

export function Contact() {
  const { branches } = useStore()
  const zoo = branches?.find((b) => b.slug === 'zoo-road') ?? branches?.[0] ?? null
  if (!zoo) {
    return (
      <>
        <PageHead eyebrow="Contact" title="Talk to Rashko" />
        <p className="mx-auto max-w-2xl px-5 py-16 text-center text-moss/70">Loading…</p>
      </>
    )
  }
  const telHref = zoo.phone ? `tel:${zoo.phone.replace(/\s/g, '')}` : undefined
  return (
    <>
      <PageHead eyebrow="Contact" title="Talk to Rashko" />
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-16 md:grid-cols-2 md:px-8">
        <Reveal variant="left" className="rounded-3xl bg-cream p-8">
          <h2 className="font-display text-4xl font-semibold">{zoo.name} branch</h2>
          <ul className="mt-6 space-y-4">
            <li className="flex gap-3"><PinIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-dark" />{zoo.address ?? TBC}</li>
            <li className="flex gap-3"><PhoneIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-dark" />
              {telHref ? <a className="font-semibold hover:text-brand-dark" href={telHref}>{zoo.phone}</a> : <span>{TBC}</span>}
            </li>
            <li className="flex gap-3"><ClockIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-dark" />{zoo.hours ?? TBC}</li>
          </ul>
          <div className="mt-7 flex flex-wrap gap-3">
            {telHref && <a href={telHref} className="btn btn-primary">Call now</a>}
            {zoo.address && (
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(zoo.address)}`} target="_blank" rel="noreferrer" className="btn btn-ghost">Get directions</a>
            )}
          </div>
        </Reveal>
        <Reveal variant="right" className="rounded-3xl bg-ink p-8 text-ivory">
          <Star size={36} className="text-mint" />
          <h2 className="mt-4 font-display text-4xl font-semibold">Other branches</h2>
          <p className="mt-3 leading-relaxed text-sand/85">
            See the Branches page for every branch's address, phone number and opening hours.
          </p>
        </Reveal>
      </div>
    </>
  )
}

export function NotFound() {
  return (
    <div className="px-5 pb-32 pt-48 text-center">
      <Star size={56} className="float mx-auto text-brand-dark" />
      <h1 className="mt-6 font-display text-6xl font-semibold md:text-8xl">Page not found</h1>
      <p className="mt-4 text-lg text-moss/75">That page isn’t on our table.</p>
      <Link to="/" className="btn btn-primary mt-8">Back home</Link>
    </div>
  )
}
