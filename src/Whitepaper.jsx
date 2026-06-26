import { useEffect, useState } from 'react';
import { Logo } from './Logo.jsx';
import {
  UNITORCH_CA_DISPLAY,
  UNITORCH_HOOK_CA_DISPLAY,
  UNITORCH_TWITTER_URL,
  UNISWAP_BUY_URL,
  UNITORCH_INITIAL_SUPPLY,
} from './config/deployed.js';
import { HOLDER_THRESHOLD_LABEL } from './config/holder.js';
import { initCaStrip } from './ca-strip.js';

const NAV_ITEMS = [
  { id: 'overview', label: 'ABSTRACT' },
  { id: 'signal-001', label: 'THE TOKEN' },
  { id: 'signal-002', label: 'BURN MECHANISM' },
  { id: 'signal-003', label: 'THE HOOK' },
  { id: 'signal-004', label: 'HOLDER NFT' },
  { id: 'signal-005', label: 'FEE REWARDS' },
  { id: 'signal-006', label: 'TOKENOMICS' },
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
        <div key={label} className="border border-zinc-800 bg-zinc-950 p-4">
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
                href={UNITORCH_TWITTER_URL}
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
                Buy UNITORCH ↗
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
              <p className="ca-strip-label">&gt; contract_address · UNITORCH</p>
              <code className="ca-strip-address" id="ca-address-display" title="UniTorch token contract" />
            </div>
            <div className="ca-strip-actions flex shrink-0 items-center gap-2">
              <a
                id="ca-explorer-link"
                href="#"
                className="ca-strip-link is-disabled"
                aria-disabled="true"
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
            <img src="/logo.png" alt="" width="24" height="24" className="site-logo-mark" aria-hidden="true" />
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
            <DocCard id="overview" badge="// 00 · abstract" title="Abstract">
              <p className="text-sm leading-relaxed text-zinc-400">
                UniTorch is a deflationary ERC-20 on Ethereum mainnet. The branded ticker is{' '}
                <Accent>UNITORCH</Accent> — a fixed-supply token whose circulating amount shrinks every time
                the Uniswap v4 pool routes a swap through its burn hook. Holders trade a normal ERC-20;
                deflation is enforced by contract logic, not promises.
              </p>
              <SpecGrid
                specs={[
                  { label: 'Network', value: 'Ethereum L1' },
                  { label: 'Genesis supply', value: `${UNITORCH_INITIAL_SUPPLY.toLocaleString()} UNITORCH` },
                  { label: 'Model', value: 'ERC-20 + v4 hook burn' },
                ]}
              />
            </DocCard>

            <DocCard id="signal-001" badge="// 01 · the token" title="The token">
              <p className="text-sm leading-relaxed text-zinc-400">
                The token contract will be published at launch — currently{' '}
                <Accent>{UNITORCH_CA_DISPLAY}</Accent>. It is a minimal
                OpenZeppelin-style ERC-20 with two extensions: a public <Accent>INITIAL_SUPPLY</Accent>{' '}
                constant and a hook-gated <Accent>burn(uint256)</Accent> function. Transfers, approvals, and
                balances behave exactly like any other ERC-20 — no rebases, no hidden transfer taxes.
              </p>
              <ItemGrid
                items={[
                  '18 decimals · standard balanceOf / transfer / transferFrom',
                  'INITIAL_SUPPLY stored immutably at deploy (137,000 tokens)',
                  'totalSupply decreases only when burn() is called',
                  'name() and symbol() readable on-chain (verify on Etherscan)',
                ]}
              />
            </DocCard>

            <DocCard id="signal-002" badge="// 02 · burn mechanism" title="Burn mechanism">
              <p className="text-sm leading-relaxed text-zinc-400">
                Burning is not a wallet send to <Accent>0x…dead</Accent>. The contract destroys tokens from
                its own balance via <Accent>burn(amount)</Accent>, which reverts unless{' '}
                <Accent>msg.sender == hook</Accent> (OnlyHook). Each successful burn lowers{' '}
                <Accent>totalSupply</Accent> while <Accent>INITIAL_SUPPLY</Accent> stays unchanged — the gap
                is the cumulative burn tally anyone can audit.
              </p>
              <ItemGrid
                items={[
                  'burn reduces totalSupply — tokens are destroyed, not redirected',
                  'only the wired hook address may call burn',
                  'wallet-to-wallet transfers do not burn',
                  'burn progress = INITIAL_SUPPLY − totalSupply',
                ]}
              />
            </DocCard>

            <DocCard id="signal-003" badge="// 03 · the hook" title="The hook">
              <p className="text-sm leading-relaxed text-zinc-400">
                At deploy the hook slot is empty. The owner calls <Accent>setHook(address)</Accent> once to
                wire the Uniswap v4 hook; a <Accent>HookSet</Accent> event is emitted and further calls
                revert with <Accent>HookAlreadySet</Accent>. The live hook burns UNITORCH when pool swaps
                execute — that is where deflation meets trading volume.
              </p>
              <ItemGrid
                items={[
                  `token hook() → ${UNITORCH_HOOK_CA_DISPLAY}`,
                  'setHook guarded — single assignment only',
                  'hook contract verified separately on Etherscan',
                  'swap volume → hook → burn() on token',
                ]}
              />
            </DocCard>

            <DocCard id="signal-004" badge="// 04 · holder NFT" title="Torch NFT · hold to claim">
              <p className="text-sm leading-relaxed text-zinc-400">
                Holders who maintain at least <Accent>{HOLDER_THRESHOLD_LABEL} UNITORCH</Accent> in their
                wallet can mint a Torch NFT — an on-chain ERC-721 with procedural 24×24 flame-pixel art from
                the gallery. Each Torch is unique, fully on-chain, and links your wallet to the fee-reward
                stream. One mint per eligible wallet; the balance gate is enforced at claim time.
              </p>
              <ItemGrid
                items={[
                  `Eligibility: balanceOf ≥ ${HOLDER_THRESHOLD_LABEL} UNITORCH`,
                  'Mint: claim() on the Torch registry → unique tokenId + tokenURI SVG',
                  'Art: procedural flame pixels in the UniTorch palette (gallery preview)',
                  'Hold incentive: buy-and-hold to unlock NFT + recurring hook fees',
                ]}
              />
            </DocCard>

            <DocCard id="signal-005" badge="// 05 · fee rewards" title="Hook fees → Torch holders">
              <p className="text-sm leading-relaxed text-zinc-400">
                The Uniswap v4 hook does two jobs on every swap: it calls <Accent>burn()</Accent> on the
                token and routes a fee share into an on-chain distributor for Torch NFT holders. Rewards
                accrue continuously as pool volume runs through the hook — claim ETH whenever your{' '}
                <Accent>claimable</Accent> balance is ready. No off-chain accounting.
              </p>
              <ItemGrid
                items={[
                  'swap volume → hook → burn + fee split',
                  'Torch NFT required to participate in fee stream',
                  'claim() on distributor pulls accrued ETH to wallet',
                  'Deflation and holder rewards run in parallel',
                ]}
              />
            </DocCard>

            <DocCard id="signal-006" badge="// 06 · tokenomics" title="Tokenomics">
              <p className="text-sm leading-relaxed text-zinc-400">
                Genesis supply is <Accent>137,000 UNITORCH</Accent>. Circulating supply is always{' '}
                <Accent>totalSupply()</Accent> on-chain and falls with every hook-triggered burn. Holder
                rewards come from swap fees — not inflation — while supply shrinks through burns.
              </p>
              <SpecGrid
                specs={[
                  { label: 'INITIAL_SUPPLY', value: '137,000' },
                  { label: 'Burn trigger', value: 'v4 hook only' },
                  { label: 'Holder gate', value: `${HOLDER_THRESHOLD_LABEL} UNITORCH` },
                ]}
              />
            </DocCard>

            <DocCard id="signal-007" badge="// 07 · contracts" title="Contracts">
              <p className="text-sm leading-relaxed text-zinc-400">
                Two on-chain addresses matter: the ERC-20 token and the v4 hook that calls burn. Both are
                verified on Etherscan:
              </p>
              <ItemGrid
                items={[
                  `UniTorch token (ERC-20) · ${UNITORCH_CA_DISPLAY}`,
                  `Burn hook · ${UNITORCH_HOOK_CA_DISPLAY}`,
                  'Torch NFT registry · VITE_TORCH_NFT (deploy & wire in .env)',
                  'Fee distributor · VITE_REWARD_DISTRIBUTOR (deploy & wire in .env)',
                ]}
              />
            </DocCard>

            <DocCard id="signal-008" badge="// 08 · parameters" title="Parameters">
              <SpecGrid
                specs={[
                  { label: 'Token', value: UNITORCH_CA_DISPLAY },
                  { label: 'Hook', value: UNITORCH_HOOK_CA_DISPLAY },
                  { label: 'Genesis', value: '137,000 UNITORCH' },
                ]}
              />
              <CodeBlock>{`UniTorch (ERC-20)     ${UNITORCH_CA_DISPLAY}
Burn hook             ${UNITORCH_HOOK_CA_DISPLAY}
Uniswap               ${UNISWAP_BUY_URL}`}</CodeBlock>
              <p className="mt-6 text-sm leading-relaxed text-zinc-400">
                Buy UNITORCH, hold {HOLDER_THRESHOLD_LABEL}, claim your Torch NFT, and earn hook fees while{' '}
                <Accent>totalSupply</Accent> falls on every swap.
              </p>
              <p className="mt-6 border-t border-zinc-800 pt-6 text-xs leading-relaxed text-zinc-500">
                Pre-launch technical specification — not
                financial or legal advice.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <a
                  href="/"
                  className="border border-zinc-700 px-5 py-3 text-xs uppercase tracking-widest text-zinc-300 transition-colors hover:border-fluor hover:text-fluor"
                >
                  ← Back to landing
                </a>
                <a
                  href="/#holder-rewards"
                  className="border border-fluor bg-fluor px-5 py-3 text-xs uppercase tracking-widest text-black transition-opacity hover:opacity-90"
                >
                  Holder rewards ↗
                </a>
              </div>
            </DocCard>
          </div>

          <footer className="mx-auto mt-4 max-w-4xl border-t border-zinc-800 py-8 text-center text-[10px] uppercase tracking-[0.3em] text-fluor">
            © 2026 UniTorch · on-chain &amp; verifiable · UNITORCH
          </footer>
        </main>
      </div>
    </>
  );
}
