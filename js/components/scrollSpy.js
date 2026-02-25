// /js/components/scrollSpy.js

/**
 * Scroll Spy Functionality
 * Highlights navigation dots based on current scroll position
 * and adds animations to section elements as they come into view
 */
export function initScrollSpy() {
    const sections = document.querySelectorAll('section');
    const navDots = document.querySelectorAll('.nav-dot');

    const observerOptions = {
        root: null,
        rootMargin: '-10% 0px -10% 0px', // Relaxed margins for better detection
        threshold: [0.15, 0.3, 0.5] // Multiple thresholds for smoother transitions
    };

    const observerCallback = (entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const currentId = entry.target.getAttribute('id');
                updateActiveNavDot(currentId);

                // Add visible class to all elements in the section with staggered delay
                const elements = entry.target.querySelectorAll('.timeline-item, .contact-method, .social-link, .timeline-container, .contact-container');
                elements.forEach((el, index) => {
                    setTimeout(() => {
                        el.classList.add('visible');
                    }, index * 100); // Staggered animation with 100ms delay between elements
                });
            }
        });
    };

    const updateActiveNavDot = (id) => {
        navDots.forEach(dot => {
            dot.classList.remove('active');
            if (dot.getAttribute('data-section') === id) {
                dot.classList.add('active');
            }
        });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    sections.forEach(section => {
        observer.observe(section);
    });

    // Handle click on nav dots - IMPROVED SCROLL HANDLING
    navDots.forEach(dot => {
        dot.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = dot.getAttribute('data-section');
            const targetSection = document.getElementById(targetId);

            if (targetSection) {
                // Calculate position with increased offset to ensure the section is properly visible
                const offset = 50; // Increased from 100 to provide more space at the top
                const targetPosition = targetSection.getBoundingClientRect().top + window.pageYOffset + offset;

                // Smooth scroll to the calculated position
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Make sure section titles are visible
    document.querySelectorAll('.section-title').forEach(title => {
        title.classList.add('visible');
    });

    // Handle keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && e.shiftKey) {
            // Shift+Tab navigation
            navDots.forEach(dot => {
                dot.setAttribute('tabindex', '0');
            });
        }
    });

    // Handle hash links in the URL for proper scrolling
    if (window.location.hash) {
        const targetId = window.location.hash.substring(1);
        const targetSection = document.getElementById(targetId);

        if (targetSection) {
            setTimeout(() => {
                const offset = 160; // Increased from 100 to match the nav dot click handling
                const targetPosition = targetSection.getBoundingClientRect().top + window.pageYOffset - offset;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }, 300); // Short delay to ensure page is fully loaded
        }
    }

    // Additional handler for all links with hash navigation
    document.querySelectorAll('a[href^="#"]:not(.nav-dot)').forEach(link => {
        link.addEventListener('click', (e) => {
            const targetId = link.getAttribute('href').substring(1);

            // Only process if target exists and is not empty
            if (targetId && document.getElementById(targetId)) {
                e.preventDefault();
                const targetSection = document.getElementById(targetId);
                const offset = 160; // Increased from 100 to match other scroll handlers
                const targetPosition = targetSection.getBoundingClientRect().top + window.pageYOffset - offset;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}