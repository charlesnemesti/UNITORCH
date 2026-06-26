import './style.css';
import { createHackedTypewriter, HERO_TITLE_TEXT, HERO_TYPEWRITER_TEXT, heroTitleSegmentClass } from './hacked-typewriter.js';
import { liveDataEnabled, LAUNCH_TERMINAL_MESSAGE } from './config/launch.js';
import { initLaunchHeroStats } from './launch-terminal-stats.js';
import { initCaStrip } from './ca-strip.js';
import { initTorchFireHero, disposeTorchFireHero } from './torch-fire-hero.js';
import {
  connect,
  tryAutoConnect,
  refresh,
  disconnect,
  initWalletListeners,
  contractsConfigured,
  initWalletModal,
  openWalletModal,
  closeWalletDropdowns,
  initWalletDropdown,
  readProtocolStats,
  readTokenMetadata,
  loadSampleHashes,
  claimTorchNft,
  claimHookFees,
  UNISWAP_BUY_URL,
} from './web3/index.js';
import { getHashSvgCatalog } from './hash-svgs.js';
import { HOLDER_THRESHOLD, HOLDER_THRESHOLD_LABEL } from './config/holder.js';

// ═══════════════════════════════════════════════════════════════════════════
// HERO — typewriter subtitle (fire lives in torch-fire-hero.js)
// ═══════════════════════════════════════════════════════════════════════════

/** @type {ReturnType<typeof createHackedTypewriter> | null} */
let heroTypewriter = null;

/** @type {ReturnType<typeof createHackedTypewriter> | null} */
let heroTitleTypewriter = null;

function initHeroTitleTypewriter() {
  const element = document.getElementById('hero-title-typewriter');
  if (!element) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    element.innerHTML =
      '<span class="hero-title-uni">Uni</span><span class="hero-title-torch">Torch</span>';
    return;
  }

  heroTitleTypewriter?.dispose();
  heroTitleTypewriter = createHackedTypewriter(element, {
    text: HERO_TITLE_TEXT,
    cycleMs: 5000,
    scrambleTicks: 5,
    cursorChar: '█',
    segmentClass: heroTitleSegmentClass,
  });
  heroTitleTypewriter.start();
}

function disposeHeroTitleTypewriter() {
  heroTitleTypewriter?.dispose();
  heroTitleTypewriter = null;
}

function initHeroTypewriter() {
  const element = document.getElementById('hero-typewriter');
  if (!element) return;

  heroTypewriter?.dispose();
  heroTypewriter = createHackedTypewriter(element, {
    text: HERO_TYPEWRITER_TEXT,
    cycleMs: 10000,
    scrambleTicks: 4,
  });
  heroTypewriter.start();
}

function disposeHeroTypewriter() {
  heroTypewriter?.dispose();
  heroTypewriter = null;
}

// ═══════════════════════════════════════════════════════════════════════════
// WEB3 UI — WALLET PANEL (viem + contract reads/writes)
// ═══════════════════════════════════════════════════════════════════════════

const state = {
  connected: false,
  address: null,
  refreshing: false,
  tokenBalance: 0,
  supplySharePercent: 0,
  holdProgress: 0,
  holdEligible: false,
  holdRemaining: HOLDER_THRESHOLD,
  torchTokenId: null,
  claimableEth: 0,
  canClaimNft: false,
  canClaimFees: false,
  nftDeployed: false,
  distributorDeployed: false,
};

const $ = (id) => document.getElementById(id);

const btnConnectHeader = $('btn-connect-header');
const btnConnectHeaderLabel = $('btn-connect-header-label');
const btnConnectWallet = $('btn-connect-wallet');
const btnConnectWalletLabel = $('btn-connect-wallet-label');
const walletDropdownHeader = $('wallet-dropdown-header');
const walletDropdownPanel = $('wallet-dropdown-panel');
const statusText = $('status-text');
const walletTerminalLine = $('wallet-terminal-line');
const walletStatus = $('wallet-status');
const statBalance = $('stat-balance');
const statShare = $('stat-share');
const statBurned = $('stat-burned-wallet');
const statTorchNft = $('stat-torch-nft');
const statClaimableFees = $('stat-claimable-fees');
const statHoldProgressText = $('stat-hold-progress-text');
const statHoldProgressBar = $('stat-hold-progress-bar');
const holderEligibilityCopy = $('holder-eligibility-copy');
const btnClaimTorch = $('btn-claim-torch');
const btnClaimFees = $('btn-claim-fees');

function formatWalletError(error) {
  const message = error?.shortMessage ?? error?.message ?? 'Connection failed.';

  if (message.includes('Failed to fetch') || message.includes('HTTP request failed')) {
    return 'RPC unreachable. Retrying with public endpoints — check your network and try again.';
  }

  if (message.length > 160) {
    return `${message.slice(0, 157)}…`;
  }

  return message;
}

function setStatus(message, tone = 'neutral') {
  const tones = {
    neutral: 'text-white',
    success: 'text-fluor',
    error: 'text-fluor',
    warn: 'text-fluor',
  };

  statusText.className = tones[tone] ?? tones.neutral;
  statusText.textContent = message;
}

function truncateAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatNumber(n) {
  if (!Number.isFinite(n)) return '0';
  if (Number.isInteger(n)) return n.toLocaleString('en-US');
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function formatEth(n) {
  if (!Number.isFinite(n) || n <= 0) return '0 ETH';
  return `${n.toFixed(4)} ETH`;
}

function formatPercent(n) {
  if (!Number.isFinite(n) || n <= 0) return '0%';
  if (n < 0.01) return '<0.01%';
  return `${n.toFixed(2)}%`;
}

function applyHolderStatus(holder) {
  state.tokenBalance = holder.tokenBalance;
  state.supplySharePercent = holder.supplySharePercent;
  state.holdProgress = holder.holdProgress;
  state.holdEligible = holder.holdEligible;
  state.holdRemaining = holder.holdRemaining;
  state.torchTokenId = holder.torchTokenId;
  state.claimableEth = holder.claimableEth;
  state.canClaimNft = holder.canClaimNft;
  state.canClaimFees = holder.canClaimFees;
  state.nftDeployed = holder.nftDeployed;
  state.distributorDeployed = holder.distributorDeployed;
}

function applyBalances(balances) {
  applyHolderStatus(balances);
}

function applyConnection(address, balances) {
  state.connected = true;
  state.address = address;
  applyBalances(balances);
}

function clearConnection() {
  state.connected = false;
  state.address = null;
  state.tokenBalance = 0;
  state.supplySharePercent = 0;
  state.holdProgress = 0;
  state.holdEligible = false;
  state.holdRemaining = HOLDER_THRESHOLD;
  state.torchTokenId = null;
  state.claimableEth = 0;
  state.canClaimNft = false;
  state.canClaimFees = false;
  state.nftDeployed = false;
  state.distributorDeployed = false;
}

function updateHolderProgressUI() {
  const pct = Math.round(state.holdProgress * 100);
  const held = Math.min(state.tokenBalance, HOLDER_THRESHOLD);

  if (statHoldProgressText) {
    statHoldProgressText.textContent = liveDataEnabled && state.connected
      ? `${formatNumber(held)} / ${HOLDER_THRESHOLD_LABEL}`
      : `0 / ${HOLDER_THRESHOLD_LABEL}`;
  }

  if (statHoldProgressBar) {
    statHoldProgressBar.style.width = liveDataEnabled && state.connected ? `${pct}%` : '0%';
  }

  if (holderEligibilityCopy) {
    if (!state.connected) {
      holderEligibilityCopy.textContent = `Hold ${HOLDER_THRESHOLD_LABEL} UNITORCH to unlock Torch NFT minting.`;
    } else if (state.torchTokenId) {
      holderEligibilityCopy.textContent = `Torch #${String(state.torchTokenId).padStart(4, '0')} minted — earning hook fees from swaps.`;
    } else if (state.holdEligible) {
      holderEligibilityCopy.textContent = state.nftDeployed
        ? 'Eligible — claim your Torch NFT to start earning hook fees.'
        : `Eligible on balance — NFT registry wiring pending. You hold ≥ ${HOLDER_THRESHOLD_LABEL} UNITORCH.`;
    } else if (liveDataEnabled) {
      holderEligibilityCopy.textContent = `${formatNumber(state.holdRemaining)} UNITORCH until Torch NFT eligibility.`;
    } else {
      holderEligibilityCopy.textContent = `Hold ${HOLDER_THRESHOLD_LABEL} UNITORCH to unlock Torch NFT minting.`;
    }
  }
}

/** @type {ReturnType<typeof initWalletDropdown> | null} */
let headerDropdown = null;

/** @type {ReturnType<typeof initWalletDropdown> | null} */
let panelDropdown = null;

function updateUI() {
  const busy = state.refreshing;
  const connectLabel = state.connected && state.address
    ? truncateAddress(state.address)
    : 'Connect';

  headerDropdown?.setLabel(connectLabel);
  panelDropdown?.setLabel(connectLabel);
  headerDropdown?.setConnected(state.connected);
  panelDropdown?.setConnected(state.connected);

  btnConnectHeader.disabled = busy;
  btnConnectWallet.disabled = busy;
  if (btnClaimTorch) {
    btnClaimTorch.disabled = busy || !state.connected || Boolean(state.torchTokenId) || !state.holdEligible;
  }
  if (btnClaimFees) btnClaimFees.disabled = busy || !state.canClaimFees;

  updateHolderProgressUI();

  if (state.connected) {
    walletTerminalLine.textContent = `> connected: ${state.address}`;
    walletTerminalLine.className = 'mb-8 font-mono text-sm text-fluor';

    if (liveDataEnabled) {
      statBalance.textContent = formatNumber(state.tokenBalance);
      statShare.textContent = formatPercent(state.supplySharePercent);
      statBurned.textContent = '·';

      if (statTorchNft) {
        statTorchNft.textContent = state.torchTokenId
          ? `#${String(state.torchTokenId).padStart(4, '0')}`
          : state.holdEligible
            ? 'Eligible'
            : 'Not minted';
      }

      if (statClaimableFees) {
        statClaimableFees.textContent = state.distributorDeployed
          ? formatEth(state.claimableEth)
          : 'Accruing via hook';
      }

      walletStatus.textContent = busy ? 'Processing' : state.torchTokenId ? 'Earning fees' : 'Active';
    } else {
      statBalance.textContent = '·';
      statShare.textContent = '·';
      statBurned.textContent = '·';
      if (statTorchNft) statTorchNft.textContent = '·';
      if (statClaimableFees) statClaimableFees.textContent = '·';
      walletStatus.textContent = 'Connected';
    }

    walletStatus.className = 'text-fluor';
  } else {
    walletTerminalLine.textContent = '> awaiting connection…';
    walletTerminalLine.className = 'mb-8 font-mono text-sm text-white';
    statBalance.textContent = '·';
    statShare.textContent = '·';
    statBurned.textContent = '·';
    if (statTorchNft) statTorchNft.textContent = '·';
    if (statClaimableFees) statClaimableFees.textContent = '·';
    walletStatus.textContent = 'Idle';
    walletStatus.className = 'text-white';
  }
}

function openConnectModal() {
  if (state.refreshing) return;
  closeWalletDropdowns();
  openWalletModal();
}

function changeWallet() {
  if (state.refreshing) return;
  closeWalletDropdowns();
  openWalletModal();
}

async function handleClaimTorch() {
  if (!state.connected || state.refreshing || state.torchTokenId || !state.holdEligible) return;

  state.refreshing = true;
  updateUI();
  setStatus('Submitting Torch NFT claim…', 'warn');

  try {
    if (!state.nftDeployed) {
      throw new Error('Torch NFT registry is not wired yet. Set VITE_TORCH_NFT when the contract deploys.');
    }
    await claimTorchNft();
    const balances = await refresh(state.address);
    applyConnection(state.address, balances);
    setStatus('Torch NFT claimed. View it in the gallery.', 'success');
  } catch (error) {
    console.error('[UniTorch] Torch claim failed:', error);
    setStatus(formatWalletError(error), 'error');
  } finally {
    state.refreshing = false;
    updateUI();
  }
}

async function handleClaimFees() {
  if (!state.connected || state.refreshing || !state.canClaimFees) return;

  state.refreshing = true;
  updateUI();
  setStatus('Claiming hook fees…', 'warn');

  try {
    await claimHookFees();
    const balances = await refresh(state.address);
    applyConnection(state.address, balances);
    setStatus('Hook fees claimed to your wallet.', 'success');
  } catch (error) {
    console.error('[UniTorch] Fee claim failed:', error);
    setStatus(formatWalletError(error), 'error');
  } finally {
    state.refreshing = false;
    updateUI();
  }
}

async function handleDisconnect() {
  if (state.refreshing) return;

  disconnect();
  clearConnection();
  closeWalletDropdowns();
  setStatus('Wallet disconnected.', 'neutral');
  updateUI();
}

async function connectWithProvider(provider, rdns) {
  setStatus('Requesting wallet connection...', 'warn');
  walletStatus.textContent = 'Connecting';

  try {
    const { address, balances } = await connect(provider, rdns);
    applyConnection(address, balances);

    if (!contractsConfigured()) {
      setStatus('Connected. Set contract addresses in .env to read balances.', 'warn');
    } else if (!liveDataEnabled) {
      setStatus(`Connected. ${LAUNCH_TERMINAL_MESSAGE}.`, 'warn');
    } else {
      setStatus('Connected. Wallet synced on-chain.', 'success');
    }

    updateUI();
  } catch (error) {
    console.error('[UniTorch] Wallet connection failed:', error);
    setStatus(formatWalletError(error), 'error');
    walletStatus.textContent = 'Idle';
  }
}

async function handleAccountChange(address) {
  if (!address) {
    await handleDisconnect();
    return;
  }

  state.refreshing = true;
  updateUI();

  try {
    const balances = await refresh(address);
    applyConnection(address, balances);
    setStatus('Account switched. Balances updated.', 'success');
  } catch (error) {
    console.error('[UniTorch] Refresh failed:', error);
    setStatus('Could not refresh balances.', 'error');
  } finally {
    state.refreshing = false;
    updateUI();
  }
}

async function tryRestoreSession() {
  const session = await tryAutoConnect();
  if (!session) return;

  applyConnection(session.address, session.balances);
  setStatus('Wallet reconnected.', 'success');
  updateUI();
}

async function initHeroStats() {
  const ids = ['stat-burned', 'stat-circulating', 'stat-burn-pct'];

  if (!liveDataEnabled) {
    initLaunchHeroStats(ids, 'hero-stats-launch');
    return;
  }

  ids.forEach((id) => {
    const el = $(id);
    if (el) el.textContent = '·';
  });

  if (!contractsConfigured()) return;

  try {
    const stats = await readProtocolStats();
    if (!stats) return;

    animateStat('stat-burned', Math.floor(stats.tokensBurned));
    animateStat('stat-circulating', Math.floor(stats.circulatingSupply));
    const burnPctEl = $('stat-burn-pct');
    if (burnPctEl) {
      burnPctEl.textContent = `${stats.burnPercent.toFixed(2)}%`;
    }
  } catch (error) {
    console.error('[UniTorch] Could not load protocol stats:', error);
    ids.forEach((id) => {
      const el = $(id);
      if (el) el.textContent = '—';
    });
  }
}

function animateStat(id, target) {
  const el = $(id);
  if (!el) return;

  const safeTarget = Number.isFinite(target) ? Math.max(0, target) : 0;
  if (safeTarget === 0) {
    el.textContent = '0';
    return;
  }

  let current = 0;
  const step = Math.max(1, Math.ceil(safeTarget / 60));

  const tick = () => {
    current = Math.min(current + step, safeTarget);
    el.textContent = formatNumber(current);
    if (current < safeTarget) requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

function initBuyLinks() {
  document.querySelectorAll('.buy-hash-link').forEach((link) => {
    link.href = UNISWAP_BUY_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });

  void wireHookExplorerLink();
}

async function wireHookExplorerLink() {
  const hookLink = $('hook-explorer-link');
  if (!hookLink) return;

  if (!contractsConfigured() || !liveDataEnabled) {
    hookLink.href = '#';
    hookLink.classList.add('is-disabled');
    hookLink.setAttribute('aria-disabled', 'true');
    return;
  }

  try {
    const meta = await readTokenMetadata();
    if (!meta?.hook) return;

    hookLink.href = `https://etherscan.io/address/${meta.hook}`;
    hookLink.classList.remove('is-disabled');
    hookLink.removeAttribute('aria-disabled');
  } catch {
    hookLink.href = '#';
    hookLink.classList.add('is-disabled');
    hookLink.setAttribute('aria-disabled', 'true');
  }
}

async function initGlobalBurnStat() {
  const burnedWalletEl = $('stat-burned-wallet');
  if (!burnedWalletEl || !liveDataEnabled || !contractsConfigured()) return;

  try {
    const meta = await readTokenMetadata();
    if (meta) burnedWalletEl.textContent = formatNumber(meta.tokensBurned);
  } catch {
    burnedWalletEl.textContent = '—';
  }
}

async function initTokenomics() {
  if (!liveDataEnabled) return;

  const supplyEl = $('token-total-supply');
  const symbolEl = $('token-symbol');
  if (!supplyEl) return;

  if (!contractsConfigured()) {
    supplyEl.textContent = '—';
    return;
  }

  try {
    const meta = await readTokenMetadata();
    if (!meta) return;

    supplyEl.textContent = formatNumber(meta.totalSupply);
    if (symbolEl) symbolEl.textContent = 'UNITORCH';

    const initialEl = $('token-initial-supply');
    const burnedEl = $('token-burned');
    if (initialEl) initialEl.textContent = formatNumber(meta.initialSupply);
    if (burnedEl) burnedEl.textContent = formatNumber(meta.tokensBurned);
  } catch (error) {
    console.error('[UniTorch] Could not load token metadata:', error);
    supplyEl.textContent = '—';
  }
}

function renderHashPreview(svgMarkup) {
  return `<svg viewBox="0 0 24 24" class="h-full w-full">${svgMarkup}</svg>`;
}

function initLandingFlamePatterns() {
  const patterns = getHashSvgCatalog(12);

  const grid = $('landing-gallery-grid');
  if (grid) {
    grid.innerHTML = patterns
      .map((svg, index) => {
        const hiddenClass =
          index >= 10 ? ' hidden md:block' : index >= 8 ? ' hidden sm:block' : '';
        return `<div class="gallery-cell${hiddenClass}" title="#${String(index + 1).padStart(4, '0')}"><svg viewBox="0 0 24 24">${svg}</svg></div>`;
      })
      .join('');
    grid.removeAttribute('aria-busy');
  }

  const cardsRoot = $('torch-showcase-cards');
  if (cardsRoot) {
    const featured = [patterns[0], patterns[7], patterns[11]];
    const cardClasses = ['hash-card hash-card--live', 'hash-card hash-card--sealed', 'hash-card hash-card--live'];
    const labels = ['Torch NFT · claimable', 'Hook fees · accruing', 'Hold 200 · eligible'];

    cardsRoot.innerHTML = featured
      .map(
        (svg, index) => `
          <article class="${cardClasses[index] ?? 'hash-card hash-card--live'}">
            <div class="hash-preview${index === 2 ? ' hash-preview--dim' : ''}" aria-hidden="true">${renderHashPreview(svg)}</div>
            <div>
              <p class="hash-name">torch_${String(index + 1).padStart(4, '0')}</p>
              <p class="hash-status hash-status--active">${labels[index] ?? 'Procedural'} · flame pixel art</p>
            </div>
          </article>`,
      )
      .join('');
    cardsRoot.removeAttribute('aria-busy');
  }
}

async function initLandingOnChainContent() {
  initLandingFlamePatterns();

  if (!liveDataEnabled || !contractsConfigured()) return;

  try {
    await loadSampleHashes(15);
  } catch (error) {
    console.error('[UniTorch] Could not load landing previews:', error);
  }
}

function initWeb3UI() {
  const dropdownOptions = {
    isConnected: () => state.connected,
    onConnect: openConnectModal,
    onChangeWallet: changeWallet,
    onDisconnect: handleDisconnect,
  };

  if (walletDropdownHeader && btnConnectHeader && btnConnectHeaderLabel) {
    headerDropdown = initWalletDropdown({
      root: walletDropdownHeader,
      trigger: btnConnectHeader,
      label: btnConnectHeaderLabel,
      menu: walletDropdownHeader.querySelector('.wallet-dropdown-menu'),
      ...dropdownOptions,
    });
  }

  if (walletDropdownPanel && btnConnectWallet && btnConnectWalletLabel) {
    panelDropdown = initWalletDropdown({
      root: walletDropdownPanel,
      trigger: btnConnectWallet,
      label: btnConnectWalletLabel,
      menu: walletDropdownPanel.querySelector('.wallet-dropdown-menu'),
      ...dropdownOptions,
    });
  }

  initWalletModal(connectWithProvider);
  initWalletListeners(handleAccountChange);
  btnClaimTorch?.addEventListener('click', handleClaimTorch);
  btnClaimFees?.addEventListener('click', handleClaimFees);
  tryRestoreSession();

  initHeroStats();
  initBuyLinks();
  initTokenomics();
  initGlobalBurnStat();
  initLandingOnChainContent();
  updateUI();
}

// ═══════════════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════════════

initTorchFireHero();
initHeroTitleTypewriter();
initHeroTypewriter();
initCaStrip();
initWeb3UI();

// Optional cleanup if hot-reloaded in dev
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposeTorchFireHero();
    disposeHeroTitleTypewriter();
    disposeHeroTypewriter();
  });
}
