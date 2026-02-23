// /js/components/contactForm.js

/**
 * a lightweight custom toast system that connect it to the Web3Forms submit
 */

function showToast(message, type = "success") {
    let overlay = document.querySelector(".toast-overlay");

    if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "toast-overlay";
        document.body.appendChild(overlay);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    overlay.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    // Auto remove
    const removeToast = () => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 350);
    };

    setTimeout(removeToast, 3000);

    // Click to dismiss
    toast.addEventListener("click", removeToast);
}


export function initContactForm() {
    const form = document.getElementById("contact-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const button = form.querySelector("button");

        button.disabled = true;
        button.textContent = "Sending...";

        try {
            const response = await fetch(form.action, {
                method: "POST",
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                showToast("Submitted. Thank you for your message!", "success");
                form.reset();
            } else {
                showToast("Something went wrong. Try again.", "error");
            }

        } catch {
            showToast("Network error. Please try again.", "error");
        }

        button.disabled = false;
        button.textContent = "Submit";
    });
}