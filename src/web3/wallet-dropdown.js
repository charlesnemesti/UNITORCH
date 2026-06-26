/** @type {HTMLElement[]} */
const dropdowns = [];

function closeAll(except) {
  dropdowns.forEach((dropdown) => {
    if (dropdown === except) return;
    dropdown.classList.remove('wallet-dropdown--open');
    dropdown.querySelector('.wallet-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
  });
}

/**
 * @param {{
 *   root: HTMLElement,
 *   trigger: HTMLButtonElement,
 *   label: HTMLElement,
 *   menu: HTMLElement,
 *   isConnected: () => boolean,
 *   onConnect: () => void,
 *   onChangeWallet: () => void,
 *   onDisconnect: () => void | Promise<void>,
 * }} options
 */
export function initWalletDropdown(options) {
  const { root, trigger, label, menu, isConnected, onConnect, onChangeWallet, onDisconnect } =
    options;

  dropdowns.push(root);

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();

    if (!isConnected()) {
      onConnect();
      return;
    }

    const willOpen = !root.classList.contains('wallet-dropdown--open');
    closeAll(willOpen ? root : null);
    root.classList.toggle('wallet-dropdown--open', willOpen);
    trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  });

  menu.querySelector('[data-action="change"]')?.addEventListener('click', async (event) => {
    event.stopPropagation();
    closeAll();
    onChangeWallet();
  });

  menu.querySelector('[data-action="disconnect"]')?.addEventListener('click', async (event) => {
    event.stopPropagation();
    closeAll();
    await onDisconnect();
  });

  return {
    setLabel(text) {
      label.textContent = text;
    },
    setConnected(connected) {
      root.classList.toggle('wallet-dropdown--connected', connected);
      if (!connected) {
        root.classList.remove('wallet-dropdown--open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    },
  };
}

export function closeWalletDropdowns() {
  closeAll();
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', () => closeAll());
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAll();
  });
}
