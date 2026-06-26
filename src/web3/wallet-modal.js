import { getWalletOptions } from './wallets.js';

/** @type {((provider: import('viem').EIP1193Provider, rdns: string) => void | Promise<void>) | null} */
let onWalletSelect = null;

const $ = (id) => document.getElementById(id);

function getModalElements() {
  return {
    modal: $('wallet-modal'),
    backdrop: $('wallet-modal-backdrop'),
    closeBtn: $('wallet-modal-close'),
    list: $('wallet-options'),
  };
}

function setModalOpen(open) {
  const { modal } = getModalElements();
  if (!modal) return;

  modal.classList.toggle('wallet-modal--open', open);
  modal.setAttribute('aria-hidden', open ? 'false' : 'true');
  document.body.classList.toggle('wallet-modal-open', open);
}

export function closeWalletModal() {
  setModalOpen(false);
}

export async function openWalletModal() {
  const { modal, list } = getModalElements();
  if (!modal || !list) return;

  list.innerHTML = '<li class="wallet-option wallet-option--loading">Scanning wallets…</li>';
  setModalOpen(true);

  const options = await getWalletOptions();
  list.innerHTML = '';

  if (!options.length) {
    list.innerHTML =
      '<li class="wallet-option wallet-option--empty">No wallets found. Install MetaMask or another Web3 wallet.</li>';
    return;
  }

  options.forEach((wallet) => {
    const item = document.createElement('li');
    item.className = 'wallet-option';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'wallet-option-btn';
    button.dataset.rdns = wallet.rdns;
    button.dataset.installed = wallet.installed ? 'true' : 'false';
    if (wallet.installUrl) button.dataset.installUrl = wallet.installUrl;

    const icon = document.createElement('span');
    icon.className = 'wallet-option-icon';
    icon.style.setProperty('--wallet-accent', wallet.accent);

    if (wallet.icon) {
      const img = document.createElement('img');
      img.src = wallet.icon;
      img.alt = '';
      img.width = 32;
      img.height = 32;
      icon.appendChild(img);
    } else {
      icon.textContent = wallet.name.charAt(0);
    }

    const copy = document.createElement('span');
    copy.className = 'wallet-option-copy';

    const name = document.createElement('span');
    name.className = 'wallet-option-name';
    name.textContent = wallet.name;

    const hint = document.createElement('span');
    hint.className = 'wallet-option-hint';
    hint.textContent = wallet.installed ? 'Connect' : 'Install';

    copy.append(name, hint);
    button.append(icon, copy);

    button.addEventListener('click', async () => {
      if (!wallet.installed || !wallet.provider) {
        if (wallet.installUrl) window.open(wallet.installUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      closeWalletModal();
      await onWalletSelect?.(wallet.provider, wallet.rdns);
    });

    item.appendChild(button);
    list.appendChild(item);
  });
}

/**
 * @param {(provider: import('viem').EIP1193Provider, rdns: string) => void | Promise<void>} handler
 */
export function initWalletModal(handler) {
  onWalletSelect = handler;

  const { backdrop, closeBtn, modal } = getModalElements();
  if (!modal) return;

  backdrop?.addEventListener('click', closeWalletModal);
  closeBtn?.addEventListener('click', closeWalletModal);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('wallet-modal--open')) {
      closeWalletModal();
    }
  });
}
