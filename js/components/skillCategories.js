// /js/components/skillCategories.js

/**
 * Skill Categories Functionality
 * Handles filtering of skills based on category selection
 */
export function initSkillCategoryTabs() {
    const buttons = document.querySelectorAll(".skill-category");
    
    if (!buttons.length) return;

    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            // Active UI
            buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            // Filter graph
            const category = btn.dataset.category || "all";
            window.filterSkillNodes?.(category);
        });
    });
}