/**
 * NOVA — Creative Studio
 * 인터랙션 & 애니메이션
 */

document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initScrollIndicator();
    initScrollAnimations();
    initStatsCounter();
    initContactForm();
    initSmoothScroll();
});

/* ===== 네비게이션 ===== */
function initNav() {
    const nav = document.getElementById('nav');
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.querySelector('.nav-links');

    // 스크롤 시 배경
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        const currentScroll = window.scrollY;
        if (currentScroll > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
        lastScroll = currentScroll;
    });

    // 모바일 메뉴 토글
    navToggle?.addEventListener('click', () => {
        navToggle.classList.toggle('active');
        navLinks?.classList.toggle('active');
        document.body.style.overflow = navLinks?.classList.contains('active') ? 'hidden' : '';
    });

    // 링크 클릭 시 메뉴 닫기
    navLinks?.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navToggle?.classList.remove('active');
            navLinks?.classList.remove('active');
            document.body.style.overflow = '';
        });
    });
}

/* ===== 스크롤 인디케이터 ===== */
function initScrollIndicator() {
    const indicator = document.getElementById('scrollIndicator');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 200) {
            indicator?.classList.add('hidden');
        } else {
            indicator?.classList.remove('hidden');
        }
    });
}

/* ===== 스크롤 애니메이션 (Intersection Observer) ===== */
function initScrollAnimations() {
    const animatedElements = document.querySelectorAll(
        '.work-card, .service-card'
    );

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const delay = entry.target.dataset.delay || 0;
                    setTimeout(() => {
                        entry.target.classList.add('visible');
                    }, Number(delay));
                }
            });
        },
        {
            threshold: 0.15,
            rootMargin: '0px 0px -50px 0px',
        }
    );

    animatedElements.forEach((el) => observer.observe(el));
}

/* ===== 숫자 카운터 애니메이션 ===== */
function initStatsCounter() {
    const stats = document.querySelectorAll('.stat-number');

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.5 }
    );

    stats.forEach((stat) => observer.observe(stat));
}

function animateCounter(element) {
    const target = Number(element.dataset.target);
    const duration = 2000;
    const start = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - start;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(easeOut * target);
        element.textContent = current;

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = target;
        }
    }

    requestAnimationFrame(update);
}

/* ===== 연락 폼 ===== */
function initContactForm() {
    const form = document.getElementById('contactForm');

    form?.addEventListener('submit', (e) => {
        e.preventDefault();

        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.textContent;

        btn.textContent = '전송 중...';
        btn.disabled = true;

        // 시뮬레이션 (실제로는 API 호출)
        setTimeout(() => {
            btn.textContent = '전송 완료!';
            btn.style.background = '#22c55e';

            form.reset();

            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
                btn.style.background = '';
            }, 2000);
        }, 1200);
    });
}

/* ===== 부드러운 스크롤 ===== */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return;

            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                });
            }
        });
    });
}
