// /js/components/skillCategories.js

/**
 * Skill Categories Functionality
 * Handles filtering of skills based on category selection
 */
export function initSkillCategories() {
    const categories = document.querySelectorAll('.skill-category');
    
    categories.forEach(category => {
      category.addEventListener('click', () => {
        // Remove active class from all categories
        categories.forEach(cat => cat.classList.remove('active'));
        
        // Add active class to clicked category
        category.classList.add('active');
        
        // Filter skills by category
        const selectedCategory = category.getAttribute('data-category');
        
        // Call the filter function from the skillGraph module
        // The global function is defined in skillGraph.js
        if (typeof window.filterNodesByCategory === 'function') {
          window.filterNodesByCategory(selectedCategory);
        }
      });
    });
  }