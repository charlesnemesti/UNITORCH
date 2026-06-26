import { useEffect, useState } from 'react';
import { Logo } from './Logo.jsx';
import { UNIHASH_CA, ETHERSCAN_TOKEN_URL, UNISWAP_BUY_URL } from './config/deployed.js';
import { initCaStrip } from './ca-strip.js';

const NAV_ITEMS = [
  { id: 'overview', label: 'ABSTRACT' },
  { id: 'signal-001', label: 'THE HYBRID' },
  { id: 'signal-002', label: 'PROTOCOL YIELD' },
  { id: 'signal-003', label: 'SEAL & BOND' },
  { id: 'signal-004', label: 'FEE & POOL' },
  { id: 'signal-005', label: 'LIMITS & LAUNCH' },
  { id: 'signal-006', label: 'ONCHAIN ART' },
  { id: 'signal-007', label: 'CONTRACTS' },
  { id: 'signal-008', label: 'PARAMETERS' },
];

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  history.replaceState(null, '', `#${id}`);
}

function SignalBadge({ children }) {
  return (
    <span className="mb-4 inline-block border border-fluor px-2 py-1 text-xs text-fluor">
      {children}
    </span>
  );
}

function CardTitle({ children }) {
  return (
    <h2
      className="mb-4 text-3xl uppercase text-fluor"
      style={{ fontFamily: "'VT323', monospace" }}
    >
      {children}
    </h2>
  );
}

function DocCard({ id, badge, title, children }) {
  return (
    <div
      id={id}
      className="mb-8 border border-zinc-800 bg-zinc-900/40 p-8"
      style={{ scrollMarginTop: '6rem' }}
    >
      {badge ? <SignalBadge>{badge}</SignalBadge> : null}
      {title ? <CardTitle>{title}</CardTitle> : null}
      {children}
    </div>
  );
}

function GridItem({ children }) {
  return (
    <div className="flex items-center gap-3 border border-zinc-800 bg-zinc-950 p-4 text-sm">
      <div className="h-2 w-2 shrink-0 bg-fluor" aria-hidden="true" />
      <span className="uppercase tracking-wide text-zinc-200">{children}</span>
    </div>
  );
}

function ItemGrid({ items }) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
      {items.map((item) => (
        <GridItem key={item}>{item}</GridItem>
      ))}
    </div>
  );
}

function SpecGrid({ specs }) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
      {specs.map(({ label, value }) => (
        <div
          key={label}
          className="border border-zinc-800 bg-zinc-950 p-4"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{label}</p>
          <p className="mt-2 text-sm uppercase tracking-wide text-fluor">{value}</p>
        </div>
      ))}
    </div>
  );
}

function CodeBlock({ children }) {
  return (
    <pre className="mt-6 overflow-x-auto border border-zinc-800 bg-black p-4 text-xs leading-relaxed text-fluor">
      {children}
    </pre>
  );
}

function Accent({ children }) {
  return <span className="text-fluor">{children}</span>;
}

function SidebarLink({ id, label, isActive, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`w-full py-2 text-left text-xs uppercase tracking-[0.18em] transition-colors hover:text-fluor ${
        isActive ? 'text-fluor' : 'text-zinc-500'
      }`}
    >
      {isActive ? '> ' : ''}
      {label}
    </button>
  );
}

export default function Whitepaper() {
  const [activeId, setActiveId] = useState('overview');

  useEffect(() => {
    const sections = NAV_ITEMS.map((item) => document.getElementById(item.id)).filter(Boolean);
    if (!sections.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-25% 0px -60% 0px', threshold: [0, 0.25, 0.5, 1] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    initCaStrip();
  }, []);

  const handleNav = (id) => {
    setActiveId(id);
    scrollToSection(id);
  };

  return (
    <>
      <div className="sticky top-0 z-50">
      <header className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <a href="/" className="site-logo shrink-0">
            <Logo />
          </a>
          <div className="flex shrink-0 items-center gap-3">
            <a
              href="https://x.com/UniTorch_"
              className="btn-twitter"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow UniTorch on X"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href={UNISWAP_BUY_URL}
              className="hidden border border-fluor bg-fluor px-4 py-2 text-xs uppercase tracking-widest text-black sm:inline-flex"
              target="_blank"
              rel="noopener noreferrer"
            >
              Buy UNIHASH ↗
            </a>
            <a
              href="/"
              className="border border-zinc-700 px-4 py-2 text-xs uppercase tracking-widest text-zinc-300 transition-colors hover:border-fluor hover:text-fluor"
            >
              ← Home
            </a>
          </div>
        </div>
      </header>

      <div className="ca-strip" id="ca-strip" aria-label="Token contract address">
        <div className="ca-strip-glow" aria-hidden="true" />
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-2.5">
          <div className="ca-strip-meta min-w-0 flex-1">
            <p className="ca-strip-label">&gt; contract_address · UNIHASH</p>
            <code className="ca-strip-address" id="ca-address-display" title="UniTorch token contract" />
          </div>
          <div className="ca-strip-actions flex shrink-0 items-center gap-2">
            <a
              id="ca-explorer-link"
              href={ETHERSCAN_TOKEN_URL}
              className="ca-strip-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              Etherscan ↗
            </a>
            <button type="button" className="ca-copy-btn" id="ca-copy-btn">
              Copy CA
            </button>
          </div>
        </div>
      </div>
      </div>

      <div className="flex min-h-screen bg-zinc-950 font-mono text-zinc-300">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-zinc-800 p-6 lg:block">
        <div className="mb-6 flex items-center gap-2">
          <img src="/logo.svg" alt="" width="24" height="24" className="site-logo-mark" aria-hidden="true" />
          <p className="text-xs uppercase tracking-[0.28em] text-fluor">Docs</p>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Section navigation">
          {NAV_ITEMS.map((item) => (
            <SidebarLink
              key={item.id}
              id={item.id}
              label={item.label}
              isActive={activeId === item.id}
              onClick={handleNav}
            />
          ))}
        </nav>
        <div className="mt-8 border-t border-zinc-800 pt-6">
          <a
            href="/"
            className="text-xs uppercase tracking-[0.18em] text-zinc-500 transition-colors hover:text-fluor"
          >
            ← Back to landing
          </a>
        </div>
      </aside>

      <main className="flex-1 p-8">
        <nav
          className="mb-6 flex gap-2 overflow-x-auto border border-zinc-800 bg-zinc-900/40 p-3 lg:hidden"
          aria-label="Mobile section navigation"
        >
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item.id)}
              className={`shrink-0 px-3 py-1 text-[10px] uppercase tracking-[0.14em] transition-colors hover:text-fluor ${
                activeId === item.id ? 'text-fluor' : 'text-zinc-500'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mx-auto max-w-4xl">
          <DocCard
            id="overview"
            badge="// 00 · abstract"
            title="Abstract"
          >
            <p className="text-sm leading-relaxed text-zinc-400">
              Most tokens are inert and most NFTs sit idle. UniTorch folds the two together.{' '}
              <Accent>UNIHASH</Accent> is a normal ERC-20 you buy on Uniswap, but it is also the fuel for a
              living NFT: hold <Accent>1 whole UNIHASH</Accent> and a <Accent>Hash</Accent> mints itself to
              your wallet. Each Hash earns protocol rewards from swap fees for as long as you hold. Nothing
              is staked, there is no mint page, and the art is drawn entirely on-chain.
            </p>
            <SpecGrid
              specs={[
                { label: 'Network', value: 'Ethereum L1' },
                { label: 'Supply', value: '5,000 UNIHASH' },
                { label: 'Model', value: 'DN404 hybrid' },
              ]}
            />
          </DocCard>

          <DocCard id="signal-001" badge="// 01 · the hybrid" title="The hybrid">
            <p className="text-sm leading-relaxed text-zinc-400">
              UNIHASH is a <Accent>DN404-style hybrid</Accent>. The ERC-20 and the Hash ERC-721 are linked:
              your Hash count always equals your balance divided by 1 (whole tokens only). Cross 1 and a
              Hash appears; cross 2 and a second appears; sell below 1 and the NFT burns. No separate mint
              transaction — it happens inside the transfer.
            </p>
            <ItemGrid
              items={[
                'pool, hook and contracts are flagged skipNFT — liquidity never mints Hashes',
                'only real holders spawn living 24×24 SVG artifacts',
                'fractional balances below 1 do not mint; drop below 1 and the NFT burns',
                'transferring a Hash on a marketplace moves its 1 UNIHASH backing with it',
              ]}
            />
          </DocCard>

          <DocCard id="signal-002" badge="// 02 · protocol yield" title="Protocol yield">
            <p className="text-sm leading-relaxed text-zinc-400">
              Rewards are real and on-chain. The <Accent>4% swap fee</Accent> routes to a protocol treasury;
              a distributor streams ETH back to Hash holders proportional to reward weight. Accrual is
              automatic — you <Accent>claim whenever you want</Accent>.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              Treat yield as variable, not a fixed APY. The Ethereum contracts handle the token, the Hashes,
              and the payout trustlessly. Anyone can verify the distributor on Etherscan.
            </p>
            <ItemGrid
              items={[
                'rewards accrue by magnified-dividend accounting — exact to the wei',
                'live Hash weight: 100 · sealed bond max: 250 (2.5×)',
                'claim() pulls accrued ETH from the treasury distributor',
              ]}
            />
          </DocCard>

          <DocCard id="signal-003" badge="// 03 · seal & bond" title="Seal & bond">
            <p className="text-sm leading-relaxed text-zinc-400">
              A live Hash mirrors your balance — selling can burn it. <Accent>Sealing</Accent> locks 1 UNIHASH
              into the contract and makes the Hash permanent, detached from your tradeable balance. In return
              it starts a <Accent>bond</Accent> that grows the longer it stays sealed.
            </p>
            <ItemGrid
              items={[
                'live Hash reward weight: 100',
                'sealed Hash weight climbs from 100 toward 250 over 90 days (2.5× max)',
                'unsealing returns backing minus 8% burn and retires the Hash',
                'sealed tokenURI is frozen permanently in contract storage',
              ]}
            />
          </DocCard>

          <DocCard id="signal-004" badge="// 04 · fee & pool" title="Fee & the pool">
            <p className="text-sm leading-relaxed text-zinc-400">
              UNIHASH trades against ETH in a Uniswap v4 pool. A v4 <Accent>hook</Accent> takes a{' '}
              <Accent>4% fee</Accent> on the ETH side of each swap and sends it to the treasury — funding
              holder rewards. The hook adds no extra swap logic beyond the fee. Pool fee is zero; the hook
              is the only fee.
            </p>
            <ItemGrid
              items={[
                'currency0: native ETH · currency1: UNIHASH',
                'fee: 0 · hook: HashHook',
                '4% ETH-side fee → treasury → distributor → holders',
              ]}
            />
          </DocCard>

          <DocCard id="signal-005" badge="// 05 · limits & launch" title="Limits & launch">
            <p className="text-sm leading-relaxed text-zinc-400">
              UniTorch is a <Accent>fair launch</Accent>: the entire 5,000 UNIHASH supply pairs into the pool
              with 1 ETH — no team allocation, nothing held back. Two limits enforce on-chain at open:
            </p>
            <ItemGrid
              items={[
                'max 0.1% of supply per buy (5 UNIHASH)',
                'max 2% of supply per wallet (100 UNIHASH)',
                'limits liftable by owner after launch with a documented floor',
                'ownership renounced before public trading',
              ]}
            />
          </DocCard>

          <DocCard id="signal-006" badge="// 06 · onchain art" title="Onchain art">
            <p className="text-sm leading-relaxed text-zinc-400">
              Every Hash is drawn on Ethereum, not hosted on a server. Renders are compact{' '}
              <Accent>24×24 SVGs</Accent> generated from packed genome data. Live Hashes read current
              balance state; sealed Hashes hold a frozen snapshot written at seal time.
            </p>
            <ItemGrid
              items={[
                'palette: void black, fluor yellow, white',
                'genome seed from owner + spawn block + tokenId',
                'live objectURI mutates · sealed tokenURI frozen forever',
                'image field: inline data:image/svg+xml;base64 — no IPFS',
              ]}
            />
            <CodeBlock>{`{
  "name": "Hash #0042",
  "description": "UniTorch · 100% on-chain · spawn block 19842103",
  "image": "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PScwIDAgMjQgMjQnP..."
}`}</CodeBlock>
          </DocCard>

          <DocCard id="signal-007" badge="// 07 · contracts" title="The contracts">
            <p className="text-sm leading-relaxed text-zinc-400">
              The core is a small, readable set; the renderer is a pure library behind a single assembler.
              All verifiable on Etherscan:
            </p>
            <ItemGrid
              items={[
                'HashToken · UNIHASH + hybrid + dividend points + seal/bond',
                'HashRegistry · ERC-721 face of your Hashes',
                'HashHook · v4 hook and swap fee',
                'RewardDistributor · treasury ETH streams to holders',
                'SvgRenderer + MetadataAssembler · on-chain 24×24 art',
              ]}
            />
          </DocCard>

          <DocCard id="signal-008" badge="// 08 · parameters" title="Parameters">
            <SpecGrid
              specs={[
                { label: 'Supply', value: '5,000 UNIHASH' },
                { label: 'UNIHASH per Hash', value: '1 whole token' },
                { label: 'Max buy / wallet', value: '5 / 100' },
              ]}
            />
            <ItemGrid
              items={[
                'swap fee: 4% (hook → treasury → yield)',
                'bond: 1.0× → 2.5× over 90 days sealed',
                'unseal burn: 8% of backing',
                'launch: fair, 100% into pool with 1 ETH',
                'mint rule: ≥1 whole UNIHASH spawns · <1 burns',
              ]}
            />
            <CodeBlock>{`UniTorch (token + hook)  ${UNIHASH_CA}
Etherscan                      ${ETHERSCAN_TOKEN_URL}
Status                         ready after launch`}</CodeBlock>
            <p className="mt-6 text-sm leading-relaxed text-zinc-400">
              Hold UNIHASH, grow a Hash, earn rewards. Everything above runs on-chain the moment you cross 1
              whole token.
            </p>
            <p className="mt-6 border-t border-zinc-800 pt-6 text-xs leading-relaxed text-zinc-500">
              Docs updated from the source tree under review. Technical specification — not financial or
              legal advice.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <a
                href="/"
                className="border border-zinc-700 px-5 py-3 text-xs uppercase tracking-widest text-zinc-300 transition-colors hover:border-fluor hover:text-fluor"
              >
                ← Back to landing
              </a>
              <a
                href="/#wallet"
                className="border border-fluor bg-fluor px-5 py-3 text-xs uppercase tracking-widest text-black transition-opacity hover:opacity-90"
              >
                Connect wallet ↗
              </a>
            </div>
          </DocCard>
        </div>

        <footer className="mx-auto mt-4 max-w-4xl border-t border-zinc-800 py-8 text-center text-[10px] uppercase tracking-[0.3em] text-fluor">
          © 2026 UniTorch · on-chain &amp; verifiable · UNIHASH
        </footer>
      </main>
      </div>
    </>
  );
}
