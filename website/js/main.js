// OfferForge — Landing page interactions

// === Scroll progress bar ===
const scrollProgress = document.querySelector('.scroll-progress');
window.addEventListener('scroll', () => {
  const scrolled = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
  scrollProgress.style.width = scrolled + '%';
}, { passive: true });

// === Navbar scroll effect ===
const nav = document.querySelector('.nav');
window.addEventListener('scroll', () => {
  if (window.scrollY > 20) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
}, { passive: true });

// === Scroll reveal animations ===
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

document.querySelectorAll('.reveal, .reveal-stagger').forEach((el) => {
  revealObserver.observe(el);
});

// === Count-up animation for stats ===
const countObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const target = el.dataset.count;
      if (target) {
        let current = 0;
        const suffix = el.dataset.suffix || '';
        const isFloat = target.includes('.');
        const targetNum = parseFloat(target);
        const step = targetNum / 40;
        const timer = setInterval(() => {
          current += step;
          if (current >= targetNum) {
            current = targetNum;
            clearInterval(timer);
          }
          el.textContent = (isFloat ? current.toFixed(1) : Math.floor(current)) + suffix;
        }, 20);
        el.classList.add('counted');
      }
      countObserver.unobserve(el);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('[data-count]').forEach((el) => {
  countObserver.observe(el);
});

// === Mobile menu toggle ===
const mobileToggle = document.querySelector('.nav-mobile-toggle');
const navLinks = document.querySelector('.nav-links');
if (mobileToggle) {
  mobileToggle.addEventListener('click', () => {
    navLinks.classList.toggle('nav-links-open');
  });
}

// === Smooth scroll for anchor links ===
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// === Parallax effect on hero orbs ===
const orbs = document.querySelectorAll('.hero-orb');
window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;
  orbs.forEach((orb, i) => {
    const speed = (i + 1) * 0.15;
    orb.style.transform = `translateY(${scrollY * speed}px)`;
  });
}, { passive: true });
