import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Star } from '../components/ui'
import { usePageTitle } from '../meta'
import { useRestaurant } from '../live'

// Keep this in step with the copy below. A policy page with a stale date is worse than none.
const UPDATED = '26 October 2026'

function LegalHead({ eyebrow, title, lede }: { eyebrow: string; title: string; lede: string }) {
  usePageTitle(title)
  return (
    <section className="pattern-light bg-ink px-5 pb-16 pt-36 text-ivory md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="max-w-2xl">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-mint">
            <Star size={14} /> {eyebrow}
          </p>
          {/* A real h1: these are standalone pages, and SectionTitle is fixed at h2. */}
          <h1 className="font-display text-4xl font-semibold md:text-6xl">{title}</h1>
          <p className="mt-4 text-base leading-relaxed text-sand/80 md:text-lg">{lede}</p>
          <p className="mt-6 text-xs uppercase tracking-[0.25em] text-sand/55">Last updated {UPDATED}</p>
        </div>
      </div>
    </section>
  )
}

function LegalBody({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-5 py-16 md:px-8">
      <div className="space-y-10 md:space-y-12">{children}</div>
      <ContactBlock />
      <LegalLinks current="" />
    </div>
  )
}

function Clause({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 md:grid-cols-[3rem_1fr] md:gap-6">
      <span className="font-display text-2xl font-semibold text-brand-dark md:text-3xl" aria-hidden="true">{n}</span>
      <div>
        <h2 className="font-display text-2xl font-semibold md:text-3xl">{title}</h2>
        <div className="mt-3 space-y-3 text-[0.95rem] leading-relaxed text-moss/85">{children}</div>
      </div>
    </section>
  )
}

function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-brand-dark">{children}</ul>
}

// Uses the details the restaurant maintains in admin > Settings, with the same Zoo Road
// fallback as the footer, so a customer never reaches a dead end.
function ContactBlock() {
  const r = useRestaurant()
  const tel = r.phone?.replace(/[^\d+]/g, '') ?? ''
  return (
    <aside className="mt-16 rounded-3xl bg-cream p-7 md:p-9">
      <h2 className="font-display text-3xl font-semibold">Questions about this policy?</h2>
      <p className="mt-2 max-w-xl text-moss/80">
        Message or call us with your order code and we will help. You can also read our{' '}
        <Link to="/contact" className="font-semibold text-brand-dark underline underline-offset-2">contact details</Link>.
      </p>
      <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        {r.phone && <a href={`tel:${tel}`} className="font-semibold hover:text-brand-dark">{r.phone}</a>}
        {r.email && <a href={`mailto:${r.email}`} className="font-semibold hover:text-brand-dark">{r.email}</a>}
        {r.address && <span className="text-moss/75">{r.address}</span>}
      </div>
    </aside>
  )
}

const policies = [
  { to: '/privacy', label: 'Privacy policy' },
  { to: '/terms', label: 'Terms of service' },
  { to: '/refunds', label: 'Refund policy' },
]

function LegalLinks({ current }: { current: string }) {
  return (
    <nav aria-label="Policies" className="mt-12 flex flex-wrap gap-3 border-t border-ink/10 pt-8 text-sm">
      {policies.map((p) => p.to === current
        ? <span key={p.to} aria-current="page" className="rounded-full bg-ink px-4 py-2 font-semibold text-ivory">{p.label}</span>
        : <Link key={p.to} to={p.to} className="rounded-full border border-ink/20 px-4 py-2 font-semibold transition hover:bg-sand">{p.label}</Link>)}
    </nav>
  )
}

export function Privacy() {
  const r = useRestaurant()
  return (
    <>
      <LegalHead
        eyebrow="Legal"
        title="Privacy policy"
        lede={`How ${r.name} collects, uses and protects the information you give us when you order.`}
      />
      <LegalBody>
        <Clause n="01" title="What we collect">
          <p>When you place an order we ask for the information needed to prepare and deliver it:</p>
          <List>
            <li>your name and phone number;</li>
            <li>your email address, when paying by card (used for the payment receipt);</li>
            <li>your delivery address and any delivery instructions;</li>
            <li>the items you ordered, notes you add, and whether you asked for WhatsApp updates.</li>
          </List>
          <p>
            Card details are entered on Paystack's secure payment page. We receive only the payment
            reference and the result (paid, failed or pending) — never your card number, CVV or PIN.
          </p>
        </Clause>

        <Clause n="02" title="Cookies and your browser">
          <p>
            We do not use advertising or analytics cookies. Your browser's local storage keeps your cart
            and chosen branch so it survives a refresh, and the order page keeps the phone number you
            used in that tab so you can reopen your order. You can clear this at any time in your
            browser settings; the cart will simply start empty.
          </p>
        </Clause>

        <Clause n="03" title="Why we use it">
          <List>
            <li>to confirm, prepare, deliver or hand over your order;</li>
            <li>to contact you about the order — including on WhatsApp if you ticked that box;</li>
            <li>to process payment and issue a receipt through Paystack;</li>
            <li>to keep records for accounting, refunds and resolving disputes;</li>
            <li>to protect the service, for example rate limiting automated requests and detecting fraud.</li>
          </List>
        </Clause>

        <Clause n="04" title="Who we share it with">
          <p>
            We share only what each provider needs to do its job: Paystack for card payments, Meta's
            WhatsApp Cloud API for order updates you opted into, and the hosting and database providers
            that run this site. Staff at your chosen branch can see the order details they need to
            prepare it. <strong>We do not sell your personal information.</strong>
          </p>
        </Clause>

        <Clause n="05" title="How long we keep it">
          <p>
            Order and payment records are kept for as long as we need them for accounting, refunds and
            legal obligations. WhatsApp messages are logged with the order so we can check what was sent.
            You can ask us to delete information we are not required to keep.
          </p>
        </Clause>

        <Clause n="06" title="Your rights">
          <p>
            Under the Nigeria Data Protection Act 2023 you can ask to see the personal information we
            hold about you, have mistakes corrected, request deletion, or object to a particular use.
            Contact us with your order code and we will respond. If you are not satisfied, you can
            complain to the Nigeria Data Protection Commission (NDPC).
          </p>
        </Clause>

        <Clause n="07" title="Changes to this policy">
          <p>
            If how we handle information changes, we will update this page and its date. Continued use of
            the site after a change means the updated policy applies.
          </p>
        </Clause>
      </LegalBody>
    </>
  )
}

export function Terms() {
  const r = useRestaurant()
  return (
    <>
      <LegalHead
        eyebrow="Legal"
        title="Terms of service"
        lede={`The agreement between you and ${r.name} when you order online.`}
      />
      <LegalBody>
        <Clause n="01" title="Ordering">
          <p>
            The menu, prices, delivery fees and availability are shown for the branch you choose. Prices
            are in naira and the total at checkout is the total you pay — there are no hidden charges. A
            dish with no confirmed price cannot be ordered.
          </p>
          <p>
            Placing an order is an offer to buy. Your order is confirmed once payment succeeds and the
            confirmation screen shows your order code. If something you paid for turns out to be
            unavailable, we will contact you and refund that item or the whole order.
          </p>
        </Clause>

        <Clause n="02" title="Payment">
          <p>
            Card payments are processed by Paystack. Depending on the environment, Paystack may be in
            test mode (no real money moves) or live mode; the checkout page always says which. We never
            ask for your card details by phone, WhatsApp or email.
          </p>
          <p>
            If your card is debited but no order is confirmed, contact us with the payment reference and
            we will trace it. Failed payments should reverse automatically, but bank timing varies.
          </p>
        </Clause>

        <Clause n="03" title="Pickup and delivery">
          <List>
            <li>Pickup orders are collected at the branch you chose during its opening hours; bring your order code.</li>
            <li>Delivery is available only where the chosen branch offers it. The fee is shown before you pay.</li>
            <li>Give an accurate address and a phone number someone can answer. If we cannot reach you or find the address, the order may fail and may not be refundable.</li>
            <li>Delivery times are estimates. Weather, traffic and order volume can affect them.</li>
          </List>
        </Clause>

        <Clause n="04" title="Cancellations">
          <p>
            Food is made to order. If you need to cancel, contact the branch as soon as possible. We can
            usually cancel before preparation starts and refund you in full. Once preparation has begun,
            cancellation may not be possible. If we cancel your order, you receive a full refund. See the{' '}
            <Link to="/refunds" className="font-semibold text-brand-dark underline underline-offset-2">refund policy</Link>.
          </p>
        </Clause>

        <Clause n="05" title="Allergies and ingredients">
          <p>
            Our kitchen handles nuts, gluten, dairy, eggs, fish and other allergens, so we cannot guarantee
            that any dish is free of traces. If you have an allergy or a dietary requirement, speak to the
            branch before ordering. Descriptions on the site are a guide, not a full ingredient list.
          </p>
        </Clause>

        <Clause n="06" title="Acceptable use">
          <p>
            Please use the site as intended: do not attempt to disrupt it, probe other people's orders, or
            place fraudulent orders. We may refuse or cancel an order and report suspected fraud. Order
            codes and the phone number used at checkout are required to open an order, on purpose.
          </p>
        </Clause>

        <Clause n="07" title="Liability">
          <p>
            We are responsible for providing your order with reasonable care and skill. To the extent
            permitted by Nigerian law, we are not liable for indirect losses such as lost time or missed
            opportunity. Nothing in these terms limits liability that cannot lawfully be limited,
            including for death or personal injury caused by negligence, or for fraud.
          </p>
        </Clause>

        <Clause n="08" title="Governing law and changes">
          <p>
            These terms are governed by the laws of the Federal Republic of Nigeria, and the courts of
            Kano State have jurisdiction. We may update these terms; the date at the top shows the
            current version.
          </p>
        </Clause>
      </LegalBody>
    </>
  )
}

export function Refunds() {
  const r = useRestaurant()
  return (
    <>
      <LegalHead
        eyebrow="Legal"
        title="Refund policy"
        lede={`When ${r.name} refunds an order paid online, and how to ask.`}
      />
      <LegalBody>
        <Clause n="01" title="Failed or duplicate payments">
          <p>
            A failed payment should not create an order. If your card was debited and you did not receive
            an order code, or you were charged twice for the same order, contact us with the payment
            reference. Once we confirm it with Paystack we refund the extra or unmatched amount in full.
          </p>
        </Clause>

        <Clause n="02" title="Cancelled or unavailable items">
          <p>
            If we cancel your order, or an item you paid for is unavailable, you get a full refund for
            what we could not provide. We will offer an alternative first where one exists, but the
            choice is yours.
          </p>
        </Clause>

        <Clause n="03" title="Wrong, missing or unsatisfactory food">
          <p>
            Check your order when it arrives. If something is missing, wrong or not up to standard, tell
            the branch straight away — ideally before you leave the counter or within two hours of
            delivery — with your order code and a photo where possible. We will replace the item or
            refund it. Every case is reviewed individually; we may ask you to return the item.
          </p>
        </Clause>

        <Clause n="04" title="Change of mind">
          <p>
            You can cancel for a full refund before preparation starts. Because food is made to order,
            once preparation has begun a change of mind is not refundable. This does not affect your
            rights when the food itself is faulty.
          </p>
        </Clause>

        <Clause n="05" title="Deliveries we could not complete">
          <p>
            If delivery fails because the address was wrong or incomplete, nobody answered the phone or
            the door, or the order was refused at the door, we may be unable to refund the food. If the
            failure was ours — a late or lost delivery — contact us and we will make it right, including a
            refund where appropriate.
          </p>
        </Clause>

        <Clause n="06" title="How refunds are paid">
          <List>
            <li>Contact the branch or use the details below with your order code and what went wrong.</li>
            <li>We approve refunds to the original payment method through Paystack; we cannot refund a card in cash.</li>
            <li>Once approved, Paystack and your bank usually complete the refund within 5–10 business days. Your bank's cutoff and card issuer can add time.</li>
            <li>We will confirm by phone, email or WhatsApp when the refund has been sent.</li>
          </List>
          <p>
            If you started a chargeback with your bank, please tell us as well so we can resolve it
            directly and avoid duplicate handling.
          </p>
        </Clause>

        <Clause n="07" title="Nothing here replaces your statutory rights">
          <p>
            This policy explains how we handle refunds in practice. It does not take away rights you have
            under Nigerian consumer protection law.
          </p>
        </Clause>
      </LegalBody>
    </>
  )
}
