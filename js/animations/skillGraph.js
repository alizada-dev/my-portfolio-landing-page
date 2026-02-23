// js/animations/skillGraph.js
import { SimplexNoise } from "../utils/simplexNoise.js";

/**
 * Reusable Skills Constellation Graph (Canvas 2D)
 * - draggable nodes
 * - noise drift
 * - collisions
 * - curved links + flowing particles
 * - hover updates details panel
 * - optional API loading with fallback
 */

const DEFAULTS = {
    height: 500,
    respectReducedMotion: true,
    theme: {
        useCssVars: true,
        cssVars: {
            isDarkClass: "dark",
            bg: "--bg",
            text: "--text",
        },
        groups: {
            frontend: { color: "#3b82f6", particle: "#93c5fd" },
            backend: { color: "#22c55e", particle: "#86efac" },
            tools: { color: "#f59e0b", particle: "#fcd34d" },
            default: { color: "#94a3b8", particle: "#cbd5e1" },
        },
    },
};

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function lerp(a, b, t) { return a + (b - a) * t; }

function parseLevel(level) {
    if (typeof level === "number") return clamp(level / 100, 0, 1);
    if (typeof level !== "string") return 0.7;
    const n = parseInt(level.replace("%", "").trim(), 10);
    if (Number.isFinite(n)) return clamp(n / 100, 0, 1);
    return 0.7;
}

function getCssVar(varName, fallback = "") {
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return v || fallback;
}

async function loadFromAPI(api) {
    if (!api?.url) return null;

    const res = await fetch(api.url, {
        method: "GET",
        headers: { "Accept": "application/json", "Cache-Control": "no-cache" },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    if (data?.error) throw new Error(data.message || "API error");

    if (typeof api.transform === "function") return api.transform(data);
    // Default expectation: {skills:[], relationships:[]}
    return { skills: data.skills || [], relationships: data.relationships || [] };
}

export async function initSkillGraph(config) {
    const {
        canvasId,
        details,
        api,
        fallback,
        options,
    } = config || {};

    const opt = {
        ...DEFAULTS,
        ...(options || {}),
        theme: {
            ...DEFAULTS.theme,
            ...(options?.theme || {}),
            cssVars: { ...DEFAULTS.theme.cssVars, ...(options?.theme?.cssVars || {}) },
            groups: { ...DEFAULTS.theme.groups, ...(options?.theme?.groups || {}) },
        },
    };

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const elName = details?.name ? document.querySelector(details.name) : null;
    const elLevel = details?.level ? document.querySelector(details.level) : null;
    const elDesc = details?.description ? document.querySelector(details.description) : null;
    const elDetails = details?.container ? document.querySelector(details.container) : null;

    const reducedMotion =
        opt.respectReducedMotion &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ----- Load data (API -> fallback) -----
    let data = null;
    try {
        data = await loadFromAPI(api);
    } catch (e) {
        // swallow and use fallback
        data = null;
    }

    const skills = (data?.skills?.length ? data.skills : fallback?.skills) || [];
    const relationships = (data?.relationships?.length ? data.relationships : fallback?.relationships) || [];

    if (!skills.length) return;

    // Normalize relationships: ensure nodes exist
    const skillNames = new Set(skills.map(s => s.name));
    const rels = relationships
        .filter(r => skillNames.has(r.source) && skillNames.has(r.target))
        .map(r => ({ source: r.source, target: r.target, strength: clamp(r.strength ?? 0.6, 0, 1) }));

    // ----- Responsive canvas sizing (true pixel size) -----
    function resizeCanvas() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const container = canvas.parentElement || document.body;

        const cssW = container.clientWidth;
        const cssH = opt.height;

        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;

        canvas.width = Math.floor(cssW * dpr);
        canvas.height = Math.floor(cssH * dpr);

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
    }

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    const noise = new SimplexNoise();

    const theme = {
        isDark() {
            const cls = opt.theme.cssVars.isDarkClass;
            return document.documentElement.classList.contains(cls) || document.body.classList.contains(cls);
        },
        groupColors(group) {
            return opt.theme.groups[group] || opt.theme.groups.default;
        },
    };

    const detailsHeight = elDetails ? elDetails.offsetHeight : 90;

    // ----- Node class -----
    class SkillNode {
        constructor(skill, index) {
            this.skill = skill;
            this.index = index;

            // positions
            this.x = canvas.clientWidth / 2 + (Math.random() - 0.5) * canvas.clientWidth * 0.9;
            this.y = opt.height / 2 + (Math.random() - 0.5) * opt.height * 0.9;
            this.vx = 0;
            this.vy = 0;

            this.targetX = this.x;
            this.targetY = this.y;

            // motion
            this.noiseX = Math.random() * 1000;
            this.noiseY = Math.random() * 1000;
            this.noiseSpeed = 0.00018 + Math.random() * 0.00012;
            this.noiseMag = 0.14 + Math.random() * 0.12;

            // physics
            this.baseRadius = (skill.size || 40) * 0.65;
            this.radius = this.baseRadius;
            this.mass = Math.max(1, this.baseRadius / 6);
            this.friction = 0.985;
            this.maxSpeed = 1.7;

            // orbit ring
            this.orbitRadius = this.baseRadius * 1.5;
            this.orbitWidth = 3;
            this.orbitProgress = Math.random() * Math.PI * 2;
            this.orbitSpeed = 0.01;

            // pulse
            this.pulsePhase = Math.random() * Math.PI * 2;
            this.pulseSpeed = 0.03 + Math.random() * 0.01;

            // state
            this.isVisible = true;
            this.opacity = 1;
            this.targetOpacity = 1;
            this.isHovered = false;
            this.isSelected = false;
            this.isDragging = false;
            this.zIndex = 0;

            this.hoverMul = 1.3;

            // glow
            this.glow = 0.2;
            this.targetGlow = 0.2;

            // colors
            const c = theme.groupColors(skill.group);
            this.color = c.color;
            this.particleColor = c.particle;

            // orbit particles
            this.particles = [];
            const particleCount = Math.round((skill.size || 40) / 6);
            for (let i = 0; i < particleCount; i++) {
                this.particles.push({
                    angle: Math.random() * Math.PI * 2,
                    distance: this.baseRadius * (1.2 + Math.random() * 0.8),
                    speed: 0.01 + Math.random() * 0.01,
                    size: 1 + Math.random() * 1.5,
                    opacity: 0.35 + Math.random() * 0.35,
                });
            }

            this.levelValue = parseLevel(skill.level);
        }

        containsPoint(px, py) {
            const d = Math.hypot(px - this.x, py - this.y);
            return d <= this.radius * this.hoverMul;
        }

        applyNoise(time) {
            if (this.isDragging || reducedMotion) return;
            this.noiseX += this.noiseSpeed;
            this.noiseY += this.noiseSpeed;

            const nx = noise.noise2D(this.noiseX, time * 0.0001) * this.noiseMag;
            const ny = noise.noise2D(this.noiseY, time * 0.0001) * this.noiseMag;

            this.vx += nx * 0.04;
            this.vy += ny * 0.04;
        }

        pulse(time) {
            if (reducedMotion) return;

            const pf = Math.sin(time * this.pulseSpeed + this.pulsePhase) * 0.07;
            const targetR = this.baseRadius * (1 + pf);
            this.radius += (targetR - this.radius) * 0.1;

            this.orbitProgress += this.orbitSpeed;
            if (this.orbitProgress > Math.PI * 2) this.orbitProgress -= Math.PI * 2;

            for (const p of this.particles) {
                p.angle += p.speed * (this.isHovered ? 1.3 : 1);
                if (p.angle > Math.PI * 2) p.angle -= Math.PI * 2;
            }
        }

        handleCollisions(nodes) {
            for (const other of nodes) {
                if (other === this || !other.isVisible || !this.isVisible) continue;
                const dx = other.x - this.x;
                const dy = other.y - this.y;
                const dist = Math.hypot(dx, dy);
                const minDist = (this.radius + other.radius) * 2.3;

                if (dist < minDist && dist > 0) {
                    const angle = Math.atan2(dy, dx);
                    const force = (minDist - dist) * 0.04;

                    const total = this.mass + other.mass;
                    const fThis = force * (other.mass / total);
                    const fOther = force * (this.mass / total);

                    if (!this.isDragging) {
                        this.vx -= Math.cos(angle) * fThis;
                        this.vy -= Math.sin(angle) * fThis;
                    }
                    if (!other.isDragging) {
                        other.vx += Math.cos(angle) * fOther;
                        other.vy += Math.sin(angle) * fOther;
                    }
                }
            }
        }

        update(mouse, draggedNode, time, nodes, bottomInset) {
            // opacity
            if (!this.isVisible) {
                this.opacity += (0.2 - this.opacity) * 0.1;
                return;
            } else {
                this.opacity += (this.targetOpacity - this.opacity) * 0.1;
            }

            this.glow += (this.targetGlow - this.glow) * 0.1;

            this.applyNoise(time);

            // target spring (very weak)
            if (!this.isDragging && !reducedMotion) {
                const dx = this.targetX - this.x;
                const dy = this.targetY - this.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 5) {
                    const k = 0.0005;
                    this.vx += dx * k;
                    this.vy += dy * k;
                }
            }

            this.handleCollisions(nodes);

            // hover detection (if not dragging another node)
            this.isHovered = false;
            if (mouse.x != null && mouse.y != null && draggedNode !== this) {
                const d = Math.hypot(mouse.x - this.x, mouse.y - this.y);
                if (d < this.radius * this.hoverMul) {
                    this.isHovered = true;
                    this.targetGlow = 0.8;
                    this.zIndex = 100;
                } else if (!this.isSelected) {
                    this.targetGlow = 0.2;
                    this.zIndex = 0;
                }
            } else if (!this.isSelected) {
                this.targetGlow = 0.2;
                this.zIndex = 0;
            }

            // dragging
            if (this.isDragging && mouse.x != null && mouse.y != null) {
                this.x = mouse.x;
                this.y = mouse.y;
                this.vx = 0;
                this.vy = 0;
                this.zIndex = 200;
            } else {
                this.vx *= this.friction;
                this.vy *= this.friction;

                const sp = Math.hypot(this.vx, this.vy);
                if (sp > this.maxSpeed) {
                    this.vx = (this.vx / sp) * this.maxSpeed;
                    this.vy = (this.vy / sp) * this.maxSpeed;
                }

                this.x += this.vx;
                this.y += this.vy;
            }

            // bounds
            const margin = this.radius + 12;
            const maxX = canvas.clientWidth - margin;
            const maxY = opt.height - bottomInset;

            if (this.x < margin) { this.x = margin; this.vx = Math.abs(this.vx) * 0.5; }
            if (this.x > maxX) { this.x = maxX; this.vx = -Math.abs(this.vx) * 0.5; }
            if (this.y < margin) { this.y = margin; this.vy = Math.abs(this.vy) * 0.5; }
            if (this.y > maxY) { this.y = maxY; this.vy = -Math.abs(this.vy) * 0.5; }
        }

        draw(ctx, time) {
            if (this.opacity < 0.05) return;

            // glow
            if (this.glow > 0.1 && !reducedMotion) {
                let rgb = hexToRgb(this.color) || { r: 59, g: 130, b: 246 };

                // If faded, push the node color toward gray for a “darker tone” look
                if (this.opacity < 0.6) {
                    rgb = {
                        r: Math.round(lerp(rgb.r, 120, 0.55)),
                        g: Math.round(lerp(rgb.g, 120, 0.55)),
                        b: Math.round(lerp(rgb.b, 120, 0.55)),
                    };
                }
                const g = ctx.createRadialGradient(
                    this.x, this.y, this.radius * 0.5,
                    this.x, this.y, this.radius * 4
                );
                g.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${0.18 * this.glow})`);
                g.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
                ctx.save();
                ctx.globalAlpha = this.opacity;
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius * 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // orbit particles
            ctx.save();
            ctx.globalAlpha = this.opacity;
            for (const p of this.particles) {
                const px = this.x + Math.cos(p.angle) * p.distance;
                const py = this.y + Math.sin(p.angle) * p.distance;
                ctx.globalAlpha = p.opacity * this.opacity;
                ctx.fillStyle = this.particleColor;
                ctx.beginPath();
                ctx.arc(px, py, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();

            // orbit ring
            ctx.save();
            ctx.globalAlpha = 0.18 * this.opacity;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.orbitWidth;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.orbitRadius, 0, Math.PI * 2);
            ctx.stroke();

            // progress arc
            ctx.globalAlpha = this.opacity;
            const start = -Math.PI / 2;
            const animatedLevel = reducedMotion ? this.levelValue : Math.min(time * 0.002, this.levelValue);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.orbitRadius, start, start + animatedLevel * Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            // main node
            const rgb = hexToRgb(this.color) || { r: 59, g: 130, b: 246 };
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
            grad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0.9)`);
            grad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0.7)`);

            ctx.save();
            ctx.globalAlpha = this.opacity;
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();

            // inner border
            ctx.strokeStyle = `rgba(255,255,255,${0.25 + (this.isHovered ? 0.35 : 0)})`;
            ctx.lineWidth = this.isHovered ? 2 : 1;
            ctx.stroke();
            ctx.restore();

            // label (simple + readable)
            const fontSize = Math.max(12, this.radius / 2.2);
            ctx.save();
            ctx.globalAlpha = this.opacity;
            ctx.font = `${this.isHovered ? "700" : "600"} ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            // measure AFTER setting font
            const text = this.skill.name;
            const padX = 10, padY = 6;
            const tw = ctx.measureText(text).width + padX * 2;
            const th = fontSize + padY * 2;

            const dark = theme.isDark();
            ctx.fillStyle = dark ? `rgba(${rgb.r},${rgb.g},${rgb.b},0.85)` : "rgba(0,0,0,0.65)";
            roundRect(ctx, this.x - tw / 2, this.y - th / 2, tw, th, 6);
            ctx.fill();

            ctx.fillStyle = "#fff";
            ctx.shadowColor = "rgba(0,0,0,0.45)";
            ctx.shadowBlur = 6;
            ctx.fillText(text, this.x, this.y);
            ctx.restore();
        }
    }

    function hexToRgb(hex) {
        if (!hex || typeof hex !== "string" || !hex.startsWith("#")) return null;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        if ([r, g, b].some(Number.isNaN)) return null;
        return { r, g, b };
    }

    function roundRect(ctx, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.arcTo(x + w, y, x + w, y + h, rr);
        ctx.arcTo(x + w, y + h, x, y + h, rr);
        ctx.arcTo(x, y + h, x, y, rr);
        ctx.arcTo(x, y, x + w, y, rr);
        ctx.closePath();
    }

    // ----- Create nodes -----
    const nodes = skills.map((s, i) => new SkillNode(s, i));
    const nodeMap = Object.fromEntries(nodes.map(n => [n.skill.name, n]));

    // ----- Layout targets by group (spaced like screenshot) -----
    function arrangeByGroup() {
        const groups = new Map();
        for (const n of nodes) {
            const g = n.skill.group || "default";
            if (!groups.has(g)) groups.set(g, []);
            groups.get(g).push(n);
        }

        const keys = [...groups.keys()];
        const cx = canvas.clientWidth / 2;
        const cy = opt.height / 2;
        const maxR = Math.min(canvas.clientWidth, opt.height) * 0.42;
        const bottomInset = detailsHeight + 46;

        keys.forEach((g, idx) => {
            const angle = (idx / keys.length) * Math.PI * 2 + Math.random() * 0.25;
            const dist = maxR * (0.7 + Math.random() * 0.25);

            let gx = cx + Math.cos(angle) * dist;
            let gy = cy + Math.sin(angle) * dist;

            if (gy > opt.height - bottomInset) gy = opt.height - bottomInset - 40;

            const list = groups.get(g);
            list.forEach((node, i) => {
                const a = i * 2.4 + Math.random();
                const d = (node.baseRadius * 4) + Math.random() * maxR * 0.25;

                node.targetX = gx + Math.cos(a) * d;
                node.targetY = gy + Math.sin(a) * d;

                node.x = node.targetX + (Math.random() - 0.5) * 90;
                node.y = node.targetY + (Math.random() - 0.5) * 80;

                // keep above details panel
                node.y = Math.min(node.y, opt.height - bottomInset);
            });
        });
    }

    arrangeByGroup();

    // ----- Link particles -----
    class LinkParticles {
        constructor() {
            this.particles = [];
            this.max = 120;
        }

        spawn(src, dst, strength) {
            if (this.particles.length >= this.max) return;
            if (!src.isVisible || !dst.isVisible) return;

            const prob = (src.isHovered || dst.isHovered) ? 0.35 : 0.05;
            if (Math.random() > prob * strength) return;

            const ang = Math.random() * Math.PI * 2;
            const startX = src.x + Math.cos(ang) * src.radius * 0.8;
            const startY = src.y + Math.sin(ang) * src.radius * 0.8;

            this.particles.push({
                x: startX,
                y: startY,
                size: 1 + Math.random() * 1.3,
                speed: 0.01 + Math.random() * 0.01,
                t: 0,
                src,
                dst,
                color: src.particleColor,
                opacity: 0.28 + Math.random() * 0.35,
                cp: {
                    x: (src.x + dst.x) / 2 + (Math.random() - 0.5) * 90,
                    y: (src.y + dst.y) / 2 + (Math.random() - 0.5) * 90,
                }
            });
        }

        update() {
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                p.t += p.speed * ((p.src.isHovered || p.dst.isHovered) ? 1.35 : 1);
                if (p.t >= 1) { this.particles.splice(i, 1); continue; }

                const t = p.t, mt = 1 - t;
                p.x = mt * mt * p.src.x + 2 * mt * t * p.cp.x + t * t * p.dst.x;
                p.y = mt * mt * p.src.y + 2 * mt * t * p.cp.y + t * t * p.dst.y;

                if (p.t > 0.82) p.opacity *= 0.95;
            }

            for (const rel of rels) {
                const a = nodeMap[rel.source];
                const b = nodeMap[rel.target];
                if (!a || !b) continue;
                this.spawn(a, b, rel.strength);
                this.spawn(b, a, rel.strength);
            }
        }

        draw(ctx) {
            for (const p of this.particles) {
                if (p.src.opacity < 0.1 || p.dst.opacity < 0.1) continue;
                ctx.save();
                ctx.globalAlpha = p.opacity * Math.min(p.src.opacity, p.dst.opacity);
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
    }

    const linkParticles = new LinkParticles();

    // ----- Draw connections -----
    function drawLinks(ctx) {
        for (const rel of rels) {
            const a = nodeMap[rel.source];
            const b = nodeMap[rel.target];
            if (!a || !b) continue;
            if (a.opacity < 0.1 || b.opacity < 0.1) continue;

            const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
            grad.addColorStop(0, a.color);
            grad.addColorStop(1, b.color);

            const base = 0.12;
            const hover = 0.38;
            const alpha = (a.isHovered || b.isHovered || a.isSelected || b.isSelected) ? hover : base;

            // curve control point
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.max(1, Math.hypot(dx, dy));
            const ox = (-dy / dist) * 28;
            const oy = (dx / dist) * 28;

            ctx.save();
            ctx.globalAlpha = alpha * Math.min(a.opacity, b.opacity);
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.quadraticCurveTo(mx + ox, my + oy, b.x, b.y);
            ctx.stroke();
            ctx.restore();
        }
    }

    // ----- Mouse / dragging -----
    const mouse = { x: null, y: null };
    let dragged = null;
    let selected = null;
    let isMouseDown = false;
    let isDragging = false;

    function setDetails(node, mode = "hover") {
        if (!elName || !elLevel || !elDesc) return;

        if (!node) {
            elName.textContent = mode === "leave" ? "Hover over skills to see details" : "Hover or drag skills to explore";
            elLevel.textContent = "-";
            elDesc.textContent = "This interactive visualization shows my skills. Skills are connected based on their relationships.";
            return;
        }
        elName.textContent = node.skill.name;
        elLevel.textContent = typeof node.skill.level === "string" ? node.skill.level : `${Math.round(parseLevel(node.skill.level) * 100)}%`;
        elDesc.textContent = node.skill.description || `Professional experience with ${node.skill.name}`;
    }

    canvas.addEventListener("mousemove", (e) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;

        if (isMouseDown && dragged) isDragging = true;

        let hovered = null;
        if (!isDragging || dragged) {
            const sorted = [...nodes].sort((a, b) => b.zIndex - a.zIndex);
            for (const n of sorted) {
                if (n.isVisible && n.containsPoint(mouse.x, mouse.y)) { hovered = n; break; }
            }
        }

        if (hovered) setDetails(hovered, "hover");
        else if (dragged) setDetails(dragged, "drag");
        else setDetails(null, "none");
    });

    canvas.addEventListener("mouseleave", () => {
        mouse.x = null; mouse.y = null;
        setDetails(null, "leave");
    });

    canvas.addEventListener("mousedown", (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        isMouseDown = true;

        const sorted = [...nodes].sort((a, b) => b.zIndex - a.zIndex);
        for (const n of sorted) {
            if (n.isVisible && n.containsPoint(x, y)) {
                dragged = n;
                n.isDragging = true;
                n.zIndex = 200;

                if (selected && selected !== n) {
                    selected.isSelected = false;
                    selected.targetGlow = 0.2;
                }
                selected = n;
                n.isSelected = true;
                n.targetGlow = 0.8;

                break;
            }
        }
    });

    window.addEventListener("mouseup", () => {
        isMouseDown = false;

        if (dragged) {
            dragged.isDragging = false;
            const released = dragged;
            setTimeout(() => {
                if (!released.isHovered) released.zIndex = released.isSelected ? 100 : 0;
            }, 350);
            dragged = null;
        }
        isDragging = false;
    });

    // Optional global filters like their version
    window.filterSkillNodes = (category) => {
        for (const n of nodes) {
            if (category === "all") {
                n.isVisible = true;
                n.targetOpacity = 1;
            } else {
                const ok = (n.skill.group || "default") === category;
                n.isVisible = ok;
                n.targetOpacity = ok ? 1 : 0.2;
            }
        }
        if (selected && !selected.isVisible) {
            selected.isSelected = false;
            selected = null;
        }
        arrangeByGroup();
    };

    // Theme refresh hook (call after dark/light toggle)
    window.refreshSkillGraphTheme = () => {
        // if you move colors into CSS vars later, you could re-read them here
        // this keeps API same and lets you change group colors in config easily
    };

    // ----- Animation loop -----
    let last = 0;
    function tick(t) {
        const dt = t - last;
        last = t;

        ctx.clearRect(0, 0, canvas.clientWidth, opt.height);

        const bottomInset = detailsHeight + 26;

        // sort by zIndex for layering
        const sorted = [...nodes].sort((a, b) => a.zIndex - b.zIndex);

        for (const n of sorted) {
            n.update(mouse, dragged, t, sorted, bottomInset);
            n.pulse(t);
        }

        linkParticles.update();
        drawLinks(ctx);
        linkParticles.draw(ctx);

        for (const n of sorted) {
            n.draw(ctx, t);
        }

        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}