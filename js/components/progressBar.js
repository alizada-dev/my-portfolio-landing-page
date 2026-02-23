// /js/components/progressBar.js

/**
 * Progress Bar
 * Shows scroll progress through the page
 */

export function initProgressBar() {
    const progressBar = document.querySelector(".progress-bar");

    window.addEventListener("scroll", () => {
        const scrollTop = window.scrollY;
        const docHeight =
            document.documentElement.scrollHeight - window.innerHeight;

        const scrollPercent = (scrollTop / docHeight) * 100;
        progressBar.style.width = scrollPercent + "%";
    })
}