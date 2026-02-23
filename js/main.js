// /js/main.js

// Import component modules
import { initProgressBar } from './components/progressBar.js';
import { initTypingEffect } from './components/typingEffect.js';
import { initSkillCategoryTabs } from './components/skillCategories.js';

// Import animations
import { initSkillGraph } from './animations/skillGraph.js';

/**
 * Initialize on Document Ready
 */

document.addEventListener("DOMContentLoaded", () => {
    console.log('Initializing portfolio components...');
    
    initProgressBar();
    initTypingEffect();
    initSkillCategoryTabs();

    initSkillGraph({
        canvasId: "skill-canvas",
        details: {
            name: ".skill-name",
            level: ".skill-level",
            description: ".skill-description",
            container: ".skill-details"
        },

        // Option A: load from API (recommended if you have it)
        api: {
            url: "/api/skills.php",
            transform: (data) => ({
                skills: (data.skills || []).map(s => ({
                    name: s.name,
                    level: s.level,             // "85%" or "85"
                    group: s.group || "tools",
                    description: s.description || `Professional experience with ${s.name}`,
                    size: s.size || (34 + (parseInt(s.level) || 60) * 0.18)
                })),
                relationships: data.relationships || []
            })
        },

        // Option B: fallback (always good to keep)
        fallback: {
            skills: [
                { name: "HTML5", level: "95%", group: "frontend", description: "Semantic markup, accessibility, modern HTML", size: 45 },
                { name: "CSS3", level: "90%", group: "frontend", description: "Responsive design, animations, layout", size: 42 },
                { name: "JavaScript", level: "85%", group: "frontend", description: "ES6+, async, DOM, tooling", size: 48 },
                { name: "React", level: "80%", group: "frontend", description: "Hooks, state, component architecture", size: 46 },
                { name: "Node.js", level: "75%", group: "backend", description: "Server-side JS and APIs", size: 40 },
                { name: "MongoDB", level: "65%", group: "backend", description: "NoSQL modeling & integration", size: 36 },
                { name: "Git/GitHub", level: "90%", group: "tools", description: "Version control, collaboration", size: 42 }
            ],
            relationships: [
                { source: "HTML5", target: "CSS3", strength: 0.9 },
                { source: "HTML5", target: "JavaScript", strength: 0.8 },
                { source: "JavaScript", target: "React", strength: 0.8 },
                { source: "JavaScript", target: "Node.js", strength: 0.7 },
                { source: "Node.js", target: "MongoDB", strength: 0.7 },
                { source: "Git/GitHub", target: "JavaScript", strength: 0.5 }
            ]
        },

        // Optional configuration
        options: {
            height: 500,
            respectReducedMotion: true,
            theme: {
                // reads CSS variables if you want, otherwise uses defaults below
                useCssVars: true,
                cssVars: {
                    isDarkClass: "dark",     // html.dark
                    bg: "--bg",
                    text: "--text"
                },
                groups: {
                    frontend: { color: "#3b82f6", particle: "#93c5fd" },
                    backend: { color: "#22c55e", particle: "#86efac" },
                    tools: { color: "#f59e0b", particle: "#fcd34d" },
                    default: { color: "#94a3b8", particle: "#cbd5e1" }
                }
            }
        }
    });
})