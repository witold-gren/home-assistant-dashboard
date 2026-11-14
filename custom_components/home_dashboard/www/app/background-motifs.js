// Patterns of the background maker, drawn by code over the gradient: no pictures to ship, sharp at every size and
// coloured by whatever two colours were chosen. Each draws on a 2D context of the given size; the same seed draws the
// same picture, upright or wide.

/** "#rrggbb" as [r, g, b]. */
export function rgbOf(hex) {
  const clean = String(hex).replace("#", "");
  const full = clean.length === 3 ? [...clean].map((part) => part + part).join("") : clean.padEnd(6, "0");
  return [0, 2, 4].map((at) => Number.parseInt(full.slice(at, at + 2), 16) || 0);
}

/** A colour between two, `share` of the way to the second. */
export function mix(first, second, share) {
  const [a, b] = [rgbOf(first), rgbOf(second)];
  return `#${a.map((part, at) => Math.round(part + (b[at] - part) * share).toString(16).padStart(2, "0")).join("")}`;
}

export const lighter = (colour, share) => mix(colour, "#ffffff", share);
export const darker = (colour, share) => mix(colour, "#000000", share);
export const alpha = (colour, value) => `rgba(${rgbOf(colour).join(", ")}, ${value})`;

/** How light a colour looks, from 0 (black) to 1 (white). */
export function lightness(colour) {
  const [r, g, b] = rgbOf(colour).map((part) => {
    const value = part / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Numbers that look random but come the same for the same seed.
export function randomOf(seed = 1) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function glow(context, x, y, radius, colour, strength) {
  const light = context.createRadialGradient(x, y, 0, x, y, radius);
  light.addColorStop(0, alpha(colour, strength));
  light.addColorStop(1, alpha(colour, 0));
  context.fillStyle = light;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

// A band of ground under a curve; `curve(x)` gives its height at x.
function ground(context, width, height, curve, fill, step = 8) {
  context.beginPath();
  context.moveTo(0, height);
  for (let x = 0; x <= width + step; x += step) context.lineTo(x, curve(Math.min(x, width)));
  context.lineTo(width, height);
  context.closePath();
  context.fillStyle = fill;
  context.fill();
}

const MOTIFS = {
  hills(context, width, height, { top, bottom }, random) {
    const layers = 5;
    for (let layer = 0; layer < layers; layer += 1) {
      const share = (layer + 1) / layers;
      const base = height * (0.5 + share * 0.38);
      const [phase, wave] = [random() * Math.PI * 2, 1.2 + random() * 1.6];
      const swing = height * (0.05 - share * 0.02);
      const colour = mix(mix(lighter(bottom, 0.4), top, 0.25), darker(bottom, 0.45), share);
      ground(context, width, height, (x) => base + Math.sin((x / width) * Math.PI * wave + phase) * swing, colour);
    }
  },
  mountains(context, width, height, { top, bottom }, random) {
    glow(context, width * 0.7, height * 0.28, Math.min(width, height) * 0.22, lighter(top, 0.8), 0.7);
    for (let layer = 0; layer < 4; layer += 1) {
      const share = (layer + 1) / 4;
      const base = height * (0.5 + share * 0.34);
      const peaks = Array.from({ length: 6 + layer * 2 }, () => random());
      const colour = mix(mix(top, bottom, 0.45), darker(bottom, 0.45), share);
      ground(context, width, height, (x) => {
        const at = (x / width) * (peaks.length - 1);
        const [left, right] = [Math.floor(at), Math.min(peaks.length - 1, Math.ceil(at))];
        const between = at - left;
        const edge = 1 - Math.abs(between - 0.5) * 2;
        return base - (peaks[left] * (1 - between) + peaks[right] * between) * height * (0.2 - share * 0.08) - edge * height * 0.015;
      }, colour, 4);
    }
  },
  dunes(context, width, height, { top, bottom }, random) {
    for (let layer = 0; layer < 4; layer += 1) {
      const share = (layer + 1) / 4;
      const base = height * (0.45 + share * 0.15);
      const phase = random() * Math.PI;
      const colour = mix(lighter(bottom, 0.35), darker(bottom, 0.25), share);
      ground(context, width, height, (x) => base + Math.sin((x / width) * Math.PI * 1.1 + phase) * height * 0.08 + Math.sin((x / width) * 7 + phase) * height * 0.006, colour);
      ground(context, width, height, (x) => base + 3 + Math.sin((x / width) * Math.PI * 1.1 + phase) * height * 0.08, alpha("#ffffff", 0.08 * (1 - share)));
    }
  },
  waves(context, width, height, { top, bottom }, random) {
    for (let band = 0; band < 9; band += 1) {
      const share = band / 8;
      const base = height * (0.35 + share * 0.62);
      const [phase, swing] = [random() * Math.PI * 2, height * (0.012 + share * 0.02)];
      ground(context, width, height, (x) => base + Math.sin((x / width) * Math.PI * 3 + phase) * swing, alpha(mix(bottom, darker(top, 0.4), share), 0.35 + share * 0.3), 6);
    }
  },
  aurora(context, width, height, { top, bottom }, random) {
    context.fillStyle = alpha(darker(top, 0.6), 0.35);
    context.fillRect(0, 0, width, height);
    const colours = [lighter(bottom, 0.3), mix(top, bottom, 0.5), lighter(top, 0.4)];
    context.globalCompositeOperation = "screen";
    for (let curtain = 0; curtain < 3; curtain += 1) {
      const base = height * (0.18 + curtain * 0.12);
      const phase = random() * Math.PI * 2;
      // Whole pixels side by side: strips that overlap or leave gaps show as stripes.
      const step = Math.max(1, Math.ceil(width / 400));
      for (let x = 0; x < width; x += step) {
        const y = base + Math.sin((x / width) * Math.PI * 2 + phase) * height * 0.06;
        const tall = height * (0.12 + 0.1 * Math.sin((x / width) * 9 + phase) ** 2);
        const light = context.createLinearGradient(x, y - tall, x, y + tall * 0.3);
        light.addColorStop(0, alpha(colours[curtain], 0));
        light.addColorStop(0.7, alpha(colours[curtain], 0.3));
        light.addColorStop(1, alpha(colours[curtain], 0));
        context.fillStyle = light;
        context.fillRect(x, Math.round(y - tall), step, Math.round(tall * 1.3));
      }
    }
    context.globalCompositeOperation = "source-over";
  },
  bokeh(context, width, height, { top, bottom }, random) {
    const unit = Math.min(width, height);
    for (let light = 0; light < 38; light += 1) {
      const radius = unit * (0.02 + random() ** 2 * 0.12);
      const colour = mix(lighter(top, 0.6), lighter(bottom, 0.5), random());
      context.beginPath();
      context.arc(random() * width, random() * height, radius, 0, Math.PI * 2);
      context.fillStyle = alpha(colour, 0.08 + random() * 0.18);
      context.fill();
    }
  },
  blobs(context, width, height, { top, bottom }, random) {
    const unit = Math.max(width, height);
    const colours = [lighter(top, 0.6), darker(bottom, 0.35), mix(top, bottom, 0.5), lighter(bottom, 0.55), darker(top, 0.3), "#ffffff"];
    colours.forEach((colour) => glow(context, random() * width, random() * height, unit * (0.3 + random() * 0.3), colour, 0.6));
  },
  sunset(context, width, height, { top, bottom }) {
    const horizon = height * 0.62;
    const radius = Math.min(width, height) * 0.2;
    glow(context, width / 2, horizon, radius * 3, lighter(bottom, 0.5), 0.5);
    context.save();
    context.beginPath();
    context.rect(0, 0, width, horizon);
    context.clip();
    const sun = context.createLinearGradient(0, horizon - radius, 0, horizon + radius);
    sun.addColorStop(0, lighter(bottom, 0.6));
    sun.addColorStop(1, mix(bottom, top, 0.2));
    context.fillStyle = sun;
    context.beginPath();
    context.arc(width / 2, horizon, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
    const sea = context.createLinearGradient(0, horizon, 0, height);
    sea.addColorStop(0, darker(top, 0.15));
    sea.addColorStop(1, darker(top, 0.55));
    context.fillStyle = sea;
    context.fillRect(0, horizon, width, height - horizon);
    for (let line = 0; line < 12; line += 1) {
      const y = horizon + (height - horizon) * ((line + 0.5) / 12) ** 1.4;
      const half = radius * (1 - line / 14);
      context.fillStyle = alpha(lighter(bottom, 0.5), 0.5 - line * 0.035);
      context.fillRect(width / 2 - half, y, half * 2, Math.max(2, height * 0.004));
    }
  },
  ripples(context, width, height, { top, bottom }, random) {
    const [x, y] = [width * (0.3 + random() * 0.4), height * (0.3 + random() * 0.3)];
    const reach = Math.hypot(width, height);
    context.lineWidth = Math.max(1.5, Math.min(width, height) * 0.003);
    for (let ring = 1; ring < 40; ring += 1) {
      context.beginPath();
      context.arc(x, y, (reach / 40) * ring * (1 + ring / 60), 0, Math.PI * 2);
      context.strokeStyle = alpha(ring % 2 ? lighter(top, 0.6) : darker(bottom, 0.3), 0.3 - ring * 0.005);
      context.stroke();
    }
  },
  contours(context, width, height, { top, bottom }, random) {
    const centres = Array.from({ length: 3 }, () => [random() * width, random() * height, random() * Math.PI * 2]);
    const unit = Math.min(width, height);
    context.lineWidth = Math.max(1.2, unit * 0.0022);
    centres.forEach(([x, y, phase], index) => {
      for (let ring = 1; ring < 12; ring += 1) {
        context.beginPath();
        for (let step = 0; step <= 120; step += 1) {
          const angle = (step / 120) * Math.PI * 2;
          const radius = unit * 0.05 * ring * (1 + 0.12 * Math.sin(angle * 3 + phase + ring * 0.3) + 0.06 * Math.sin(angle * 5 - phase));
          const [px, py] = [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius];
          if (step) context.lineTo(px, py);
          else context.moveTo(px, py);
        }
        context.strokeStyle = alpha(index % 2 ? lighter(bottom, 0.5) : lighter(top, 0.5), 0.22);
        context.stroke();
      }
    });
  },
  stripes(context, width, height, { top, bottom }) {
    const reach = Math.hypot(width, height);
    context.save();
    context.translate(width / 2, height / 2);
    context.rotate(-Math.PI / 5);
    const band = reach / 14;
    for (let stripe = -8; stripe < 8; stripe += 1) {
      context.fillStyle = alpha(stripe % 2 ? lighter(top, 0.5) : darker(bottom, 0.3), 0.08 + (Math.abs(stripe) % 3) * 0.03);
      context.fillRect(-reach, stripe * band, reach * 2, band * 0.55);
    }
    context.restore();
  },
  glass(context, width, height, { top, bottom }, random) {
    const unit = Math.min(width, height);
    for (let pane = 0; pane < 9; pane += 1) {
      const [w, h] = [unit * (0.25 + random() * 0.45), unit * (0.25 + random() * 0.6)];
      context.save();
      context.translate(random() * width, random() * height);
      context.rotate((random() - 0.5) * 0.9);
      context.beginPath();
      context.roundRect(-w / 2, -h / 2, w, h, unit * 0.05);
      const fill = context.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
      fill.addColorStop(0, alpha("#ffffff", 0.16));
      fill.addColorStop(1, alpha(mix(top, bottom, random()), 0.12));
      context.fillStyle = fill;
      context.fill();
      context.strokeStyle = alpha("#ffffff", 0.18);
      context.lineWidth = Math.max(1, unit * 0.002);
      context.stroke();
      context.restore();
    }
  },
  petals(context, width, height, { top, bottom }, random) {
    const unit = Math.min(width, height);
    const flowers = [[width * 0.85, height * 0.12, 0.55], [width * 0.1, height * 0.82, 0.45], [width * 0.6, height * 0.6, 0.25]];
    flowers.forEach(([x, y, size]) => {
      const turn = random() * Math.PI;
      for (let petal = 0; petal < 12; petal += 1) {
        context.save();
        context.translate(x, y);
        context.rotate(turn + (petal / 12) * Math.PI * 2);
        context.beginPath();
        context.ellipse(unit * size * 0.32, 0, unit * size * 0.32, unit * size * 0.09, 0, 0, Math.PI * 2);
        context.fillStyle = alpha(petal % 2 ? lighter(top, 0.55) : darker(top, 0.08), 0.3);
        context.fill();
        context.restore();
      }
    });
  },
  stars(context, width, height, { top, bottom }, random) {
    context.fillStyle = alpha(darker(top, 0.7), 0.6);
    context.fillRect(0, 0, width, height);
    glow(context, width * 0.5, height * 1.05, Math.max(width, height) * 0.6, lighter(bottom, 0.2), 0.45);
    const unit = Math.min(width, height);
    for (let star = 0; star < 420; star += 1) {
      const [x, y] = [random() * width, random() ** 1.6 * height];
      context.beginPath();
      context.arc(x, y, unit * (0.0008 + random() ** 4 * 0.0035), 0, Math.PI * 2);
      context.fillStyle = alpha("#ffffff", 0.35 + random() * 0.6);
      context.fill();
    }
  },
  arcs(context, width, height, { top, bottom }) {
    const reach = Math.hypot(width, height);
    const colours = [lighter(top, 0.35), mix(top, bottom, 0.5), darker(bottom, 0.25), lighter(bottom, 0.4)];
    for (let ring = 7; ring > 0; ring -= 1) {
      context.beginPath();
      context.moveTo(width, height);
      context.arc(width, height, (reach / 8) * ring, Math.PI, Math.PI * 1.5);
      context.closePath();
      context.fillStyle = alpha(colours[ring % colours.length], 0.32);
      context.fill();
    }
  },
  paper(context, width, height, { top }, random) {
    const unit = Math.min(width, height);
    for (let fleck = 0; fleck < (width * height) / 900; fleck += 1) {
      context.fillStyle = alpha(random() > 0.5 ? "#ffffff" : darker(top, 0.5), 0.05 + random() * 0.05);
      context.fillRect(random() * width, random() * height, unit * 0.002, unit * 0.002);
    }
    const shade = context.createRadialGradient(width / 2, height / 2, unit * 0.3, width / 2, height / 2, Math.hypot(width, height) / 1.6);
    shade.addColorStop(0, "rgba(0, 0, 0, 0)");
    shade.addColorStop(1, "rgba(0, 0, 0, 0.18)");
    context.fillStyle = shade;
    context.fillRect(0, 0, width, height);
  },
};

export const MOTIF_NAMES = Object.keys(MOTIFS);

/** Draws a pattern over what is on the context already; an unknown or empty name draws nothing. */
export function drawMotif(context, width, height, name, colours, seed = 7) {
  const motif = MOTIFS[name];
  if (!motif) return;
  context.save();
  motif(context, width, height, colours, randomOf(seed));
  context.restore();
}

// Backgrounds ready to use: a pattern with colours that suit it.
export const READY_BACKGROUNDS = [
  { motif: "hills", top: "#f6d365", bottom: "#4e6a3a", angle: 180 },
  { motif: "mountains", top: "#a1c4fd", bottom: "#1d3b53", angle: 180 },
  { motif: "dunes", top: "#ffecd2", bottom: "#c9a77c", angle: 180 },
  { motif: "waves", top: "#89f7fe", bottom: "#134e5e", angle: 180 },
  { motif: "aurora", top: "#0f2027", bottom: "#71b280", angle: 180 },
  { motif: "bokeh", top: "#1a1a2e", bottom: "#b24592", angle: 160 },
  { motif: "blobs", top: "#e0c3fc", bottom: "#8ec5fc", angle: 135 },
  { motif: "sunset", top: "#3a1c71", bottom: "#ffaf7b", angle: 180 },
  { motif: "ripples", top: "#2193b0", bottom: "#6dd5ed", angle: 180 },
  { motif: "contours", top: "#2d5a3d", bottom: "#a8c69f", angle: 160 },
  { motif: "stripes", top: "#f3e7e9", bottom: "#d6c3c9", angle: 180 },
  { motif: "glass", top: "#4b6cb7", bottom: "#182848", angle: 135 },
  { motif: "petals", top: "#fbc2eb", bottom: "#f5efe6", angle: 180 },
  { motif: "stars", top: "#141e30", bottom: "#4a3f74", angle: 180 },
  { motif: "arcs", top: "#f5efe6", bottom: "#a1593d", angle: 180 },
  { motif: "paper", top: "#f5efe6", bottom: "#e4d6c3", angle: 180 },
];
