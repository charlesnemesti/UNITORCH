import './style.css';

const navLinks = document.querySelectorAll('.docs-nav-link');
const sections = document.querySelectorAll('[data-signal]');

// Smooth scroll for sidebar and in-page anchors
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (event) => {
    const id = anchor.getAttribute('href');
    if (!id || id === '#') return;

    const target = document.querySelector(id);
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', id);
  });
});

function setActiveSignal(signalId) {
  navLinks.forEach((link) => {
    link.classList.toggle('is-active', link.dataset.signal === signalId);
  });
}

if (sections.length && navLinks.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

      if (visible[0]) {
        setActiveSignal(visible[0].target.dataset.signal);
      }
    },
    {
      rootMargin: '-30% 0px -55% 0px',
      threshold: [0, 0.25, 0.5, 0.75, 1],
    },
  );

  sections.forEach((section) => observer.observe(section));

  const initialHash = window.location.hash.replace('#', '');
  if (initialHash) {
    setActiveSignal(initialHash);
  } else {
    setActiveSignal(sections[0].dataset.signal);
  }
}
