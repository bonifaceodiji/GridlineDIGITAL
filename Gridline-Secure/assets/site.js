
(() => {
  // Final polish requested for Gridline Digital.
  // Remove dash punctuation from visible copy without changing CSS, code, or HTML attributes.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach((node) => {
    node.nodeValue = node.nodeValue
      .replace(/\s+[—–]\s+/g, ' / ')
      .replace(/–/g, ' to ')
      .replace(/([A-Za-z0-9])—([A-Za-z])/g, '$1, $2')
      .replace(/([A-Za-z0-9])—([A-Za-z0-9])/g, '$1, $2');
  });

  // Keep the visual footer label on one clean, level line.
  const visualFoot = document.querySelector('.visual-foot');
  if (visualFoot) {
    visualFoot.style.display = 'flex';
    visualFoot.style.alignItems = 'center';
    visualFoot.style.gap = '16px';
    const visualLabel = visualFoot.querySelector('span');
    if (visualLabel) {
      visualLabel.style.display = 'block';
      visualLabel.style.whiteSpace = 'nowrap';
      visualLabel.style.lineHeight = '1.2';
      visualLabel.style.maxWidth = 'calc(100% - 55px)';
    }
  }

  // Footer credits: parent company and brand motto, with no duplicate company label.
  const footerBottom = document.querySelector('.footer-bottom');
  if (footerBottom) {
    const footerItems = footerBottom.querySelectorAll('span');
    if (footerItems[1]) footerItems[1].textContent = 'Powered by Lumine Group Ltd';
    const oldCredit = document.getElementById('parentCompanyCredit');
    if (oldCredit) oldCredit.remove();
    let motto = document.getElementById('footerMotto');
    if (!motto) {
      motto = document.createElement('span');
      motto.id = 'footerMotto';
      footerBottom.appendChild(motto);
    }
    motto.textContent = 'Digital experiences. Built for growth.';
  }

  const menu = document.getElementById('menu');
  const links = document.getElementById('links');
  const backTop = document.getElementById('backTop');
  const form = document.getElementById('projectForm');
  const toast = document.getElementById('toast');
  const navLinks = [...document.querySelectorAll('.links a[href^="#"]')];

  // Accessible mobile navigation.
  if (menu && links) {
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-controls', 'links');
    menu.addEventListener('click', () => {
      const isOpen = links.classList.toggle('open');
      menu.textContent = isOpen ? '×' : '☰';
      menu.setAttribute('aria-expanded', String(isOpen));
      menu.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
    });
    links.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
      links.classList.remove('open');
      menu.textContent = '☰';
      menu.setAttribute('aria-expanded', 'false');
    }));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        links.classList.remove('open');
        menu.textContent = '☰';
        menu.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Subtle reveal effects that respect reduced-motion preferences.
  const revealTargets = document.querySelectorAll('section, .service, .project, .offer-panel, .tickerin, .about-card');
  revealTargets.forEach((el, index) => {
    el.classList.add('reveal');
    if (el.classList.contains('service') || el.classList.contains('project')) {
      el.style.transitionDelay = `${(index % 3) * 70}ms`;
    }
  });
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
    revealTargets.forEach(el => observer.observe(el));
  } else {
    revealTargets.forEach(el => el.classList.add('is-visible'));
  }

  // Highlight the section currently in view.
  const sectionObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => {
          if (link.getAttribute('href') === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      }
    });
  }, { rootMargin: '-25% 0px -65% 0px' }) : null;
  document.querySelectorAll('main section[id], section[id]').forEach(section => sectionObserver && sectionObserver.observe(section));

  // Back-to-top control.
  const updateBackTop = () => backTop.classList.toggle('visible', window.scrollY > 650);
  window.addEventListener('scroll', updateBackTop, { passive: true });
  updateBackTop();
  backTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));

  // ===== SETTINGS: fill these in =====
  const SUPABASE_URL = 'https://kpjpbovphdatqmfifxes.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_-KR_19JIiGRRRRSrvzEf_g_mlH6cwNy';
  // WhatsApp number in international format: digits only, no + or spaces (example: 233241234567)
  const WHATSAPP_NUMBER = '23490357801114';
  let cooldownUntil = 0; // blocks rapid repeat submissions from the same page
  // ====================================

  // Offers for each budget range (edit the wording here any time). Join perks with " + ".
  const OFFERS = {
    '$1,000–$3,000': 'Free SEO setup + 1 month of support',
    '$3,000–$7,500': 'Free brand style guide + 2 months of support',
    '$7,500–$15,000': 'Free 1 month of promotion + 3 months of support',
    '$15,000–$20,000': 'Free mobile app + 3 months of free promotion + 6 months of priority support + Free ad-tracking setup'
  };
  const HOOKS = {
    '$1,000–$3,000': 'A strong start, with SEO built in.',
    '$3,000–$7,500': 'Look polished from day one.',
    '$7,500–$15,000': 'Get seen from the moment you launch.',
    '$15,000–$20,000': 'Launch on web and mobile, then grow with 3 months of free promotion.'
  };
  const budgetSelect = document.getElementById('budget');
  const offerNote = document.getElementById('offerNote');
  if (budgetSelect && offerNote) budgetSelect.addEventListener('change', () => {
    const v = budgetSelect.value, offer = OFFERS[v];
    if (!offer) { offerNote.classList.remove('show', 'top'); return; }
    const top = v === '$15,000–$20,000';
    offerNote.textContent = '';
    const title = document.createElement('b');
    title.textContent = 'YOUR OFFER';
    if (top) { const pop = document.createElement('span'); pop.className = 'pop'; pop.textContent = 'MOST POPULAR'; title.append(' ', pop); }
    const hook = document.createElement('strong');
    hook.textContent = HOOKS[v];
    const list = document.createElement('div');
    list.className = 'perks';
    offer.split(' + ').forEach(x => { const s = document.createElement('span'); s.textContent = '✔ ' + x; list.append(s); });
    offerNote.append(title, hook, list);
    offerNote.classList.add('show');
    offerNote.classList.toggle('top', top);
  });

  // Contact form: save the enquiry to the database, then open WhatsApp with the details pre-filled.
  if (form) form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const button = form.querySelector('button[type="submit"]');
    const name = (data.get('name') || '').trim();
    const email = (data.get('email') || '').trim();
    const service = data.get('service') || 'Not sure yet';
    const budget = data.get('budget') || 'Need guidance';
    const details = (data.get('details') || '').trim();

    // Bot trap: real visitors never see or fill this hidden field.
    if ((data.get('website') || '') !== '') { form.reset(); return; }
    if (Date.now() < cooldownUntil) { toast.textContent = 'Please wait a moment before sending again.'; toast.classList.add('show'); return; }
    if (name.length > 100 || email.length > 200 || details.length > 3000 || !/^\d{8,15}$/.test(WHATSAPP_NUMBER)) { toast.textContent = 'Please shorten your message and try again.'; toast.classList.add('show'); return; }
    cooldownUntil = Date.now() + 30000;

    button.disabled = true;
    toast.textContent = 'Sending your enquiry…';
    toast.classList.add('show');

    // 1) Save to the database (if this fails, we still continue to WhatsApp so the lead is not lost)
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ name, email, service, budget, details }),
        signal: window.AbortSignal && AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
      });
      if (!response.ok) throw new Error('Save failed');
    } catch (error) {
      console.error('Could not save enquiry.');
    }

    // 2) Send the visitor to WhatsApp with a ready-made message
    const message =
      `Hello Gridline Digital, I just submitted an enquiry on your website and I’d like to continue here on WhatsApp.\n\n` +
      `Name: ${name}\n` +
      `Email: ${email}\n` +
      `Service: ${service}\n` +
      `Budget: ${budget}\n` +
      (OFFERS[budget] ? `Offer: ${OFFERS[budget]}\n` : '') +
      `Project: ${details.slice(0, 700)}`;
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    toast.textContent = `Thank you for wanting to work with us, ${name}. Opening WhatsApp now, where we’ll confirm your project and continue the conversation.`;
    toast.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    form.reset();
    if (offerNote) offerNote.classList.remove('show', 'top');
    button.disabled = false;
    setTimeout(() => { window.location.href = whatsappUrl; }, 1200);
  });

  // Keep the copyright year current automatically.
  const copyright = document.querySelector('.footer-bottom span');
  if (copyright) copyright.textContent = copyright.textContent.replace(/© \d{4}/, `© ${new Date().getFullYear()}`);
})();
