// @ts-nocheck
// SPIN A BADDIE: the old page's own drawings, copied as they were (baddie.html),
// so the pixel sprites are made from exactly these. art.ts turns them into
// pixel art; nothing here is shown as it is.
/* eslint-disable */

export function coinSVG(size){ size=size||12; return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" class="bd-coinic" style="vertical-align:-2px;margin-right:3px;">
<circle cx="12" cy="12" r="10.5" fill="url(#bdCoinG)" stroke="#9a6406" stroke-width="1.4"/>
<circle cx="12" cy="12" r="7.4" fill="none" stroke="#fff3c0" stroke-width="0.9" opacity="0.6"/>
<path d="M12 6.6l1.7 3.5 3.8.5-2.8 2.6.7 3.8-3.4-1.9-3.4 1.9.7-3.8-2.8-2.6 3.8-.5z" fill="#fff7d6"/></svg>`; }
export function burgerSVG(size){ size=size||18; return `<svg viewBox="0 0 24 24" width="${size}" height="${size}">
<path d="M3 8c0-4 18-4 18 0z" fill="#e0a44a"/><circle cx="8" cy="6" r="0.7" fill="#fff2cf"/><circle cx="12" cy="5.4" r="0.7" fill="#fff2cf"/><circle cx="16" cy="6" r="0.7" fill="#fff2cf"/>
<rect x="3" y="8.5" width="18" height="2.4" rx="1" fill="#5bbf4a"/><rect x="3.5" y="10.6" width="17" height="2.6" fill="#7a3a1a"/><rect x="3" y="12.8" width="18" height="2.2" fill="#ffcf3a"/>
<path d="M3 15c0 4 18 4 18 0z" fill="#e0a44a"/></svg>`; }
const DICE_THEME = {
0:{lite:'#c89a63',base:'#8a5a2c',edge:'#4d3015',glow:'#c89a63',
   motif:`<line x1="14" y1="13" x2="34" y2="33" stroke="#6b4422" stroke-width="1.2" opacity=".5"/><line x1="20" y1="11" x2="37" y2="28" stroke="#6b4422" stroke-width="1" opacity=".4"/><circle cx="24" cy="24" r="3.6" fill="#3a2410"/>`},
1:{lite:'#aab0b8',base:'#71777e',edge:'#3f444a',glow:'#aab0b8',
   motif:`<path d="M15 13 L21 22 L17 31" stroke="#4a4e54" stroke-width="1.3" fill="none" opacity=".6"/><circle cx="18" cy="18" r="3" fill="#2f3338"/><circle cx="30" cy="30" r="3" fill="#2f3338"/>`},
2:{lite:'#d4dde6',base:'#8b95a0',edge:'#4a525b',glow:'#cfe0ff',
   motif:`<circle cx="11" cy="11" r="1.7" fill="#5b636b"/><circle cx="37" cy="11" r="1.7" fill="#5b636b"/><circle cx="11" cy="37" r="1.7" fill="#5b636b"/><circle cx="37" cy="37" r="1.7" fill="#5b636b"/><circle cx="18" cy="18" r="3" fill="#2f343a"/><circle cx="30" cy="18" r="3" fill="#2f343a"/><circle cx="24" cy="30" r="3" fill="#2f343a"/>`},
3:{lite:'#ffe88a',base:'#e0a312',edge:'#9a6a08',glow:'#ffd34a',
   motif:`<circle cx="18" cy="18" r="3.2" fill="#6a4a06"/><circle cx="30" cy="18" r="3.2" fill="#6a4a06"/><circle cx="18" cy="30" r="3.2" fill="#6a4a06"/><circle cx="30" cy="30" r="3.2" fill="#6a4a06"/><path d="M10 12 L16 12 L10 18 Z" fill="#fff6c0" opacity=".7"/>`},
4:{lite:'#bdf4ff',base:'#4ec6e6',edge:'#2188a6',glow:'#7fe9ff',
   motif:`<path d="M24 8 L40 24 L24 40 L8 24 Z" fill="none" stroke="#dffaff" stroke-width="1" opacity=".5"/><circle cx="24" cy="24" r="3.2" fill="#0c5566"/><circle cx="16" cy="16" r="2.3" fill="#0c5566"/><circle cx="32" cy="32" r="2.3" fill="#0c5566"/><circle cx="32" cy="16" r="2.3" fill="#0c5566"/><circle cx="16" cy="32" r="2.3" fill="#0c5566"/>`},
5:{lite:'#d6b3ff',base:'#8a3ff0',edge:'#5a1fae',glow:'#b277ff',
   motif:`<path d="M24 12l1.6 3.4 3.7.4-2.8 2.6.8 3.6-3.3-1.9-3.3 1.9.8-3.6-2.8-2.6 3.7-.4z" fill="#fff"/><circle cx="15" cy="32" r="1.6" fill="#fff"/><circle cx="33" cy="33" r="1.6" fill="#fff"/><circle cx="34" cy="15" r="1.4" fill="#fff"/>`},
6:{lite:'#3a2d5c',base:'#171029',edge:'#7a3ac0',glow:'#9a5bff',
   motif:`<circle cx="24" cy="24" r="11" fill="none" stroke="#9a5bff" stroke-width="2" opacity=".8"/><path d="M24 17 a7 7 0 1 0 0.1 0" fill="none" stroke="#c9a8ff" stroke-width="2"/><circle cx="24" cy="24" r="2.6" fill="#e6d6ff"/>`},
7:{lite:'#fff6d8',base:'#f0c860',edge:'#c89020',glow:'#ffe9a8',
   motif:`<circle cx="24" cy="24" r="7" fill="#fff" opacity=".85"/><g stroke="#fff" stroke-width="1.8" opacity=".85"><line x1="24" y1="6" x2="24" y2="12"/><line x1="24" y1="36" x2="24" y2="42"/><line x1="6" y1="24" x2="12" y2="24"/><line x1="36" y1="24" x2="42" y2="24"/></g>`},
8:{lite:'#ff8a64',base:'#e03050',edge:'#7a1830',glow:'#ff5a7a',
   motif:`<path d="M24 9l4 9 9-3-5 8 7 6-9 1 2 9-8-5-8 5 2-9-9-1 7-6-5-8 9 3z" fill="#ffe27a" opacity=".9"/>`},
9:{lite:'#ff8ae6',base:'#c216a0',edge:'#6a0a58',glow:'#ff2bd0',
   motif:`<path d="M24 8 L28 22 L42 24 L28 26 L24 40 L20 26 L6 24 L20 22 Z" fill="#fff" opacity=".92"/><circle cx="24" cy="24" r="3" fill="#ff2bd0"/>`},
};
export function diceSVG(id,size){ size=size||34; const t=DICE_THEME[id]||DICE_THEME[0];
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" class="bd-die-svg" style="filter:drop-shadow(0 0 5px ${t.glow}88);">
<defs><linearGradient id="dg${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.lite}"/><stop offset="1" stop-color="${t.base}"/></linearGradient></defs>
<rect x="5" y="5" width="38" height="38" rx="9" fill="url(#dg${id})" stroke="${t.edge}" stroke-width="2.6"/>
<path d="M9 12 Q9 9 12 9 L30 9 Q20 14 14 30 Q9 24 9 12Z" fill="#fff" opacity="0.16"/>
${t.motif}</svg>`; }
export function eggSVG(type,size){ size=size||30;
  if(type==='common') return `<svg viewBox="0 0 48 60" width="${size}" height="${size*1.25}">
<defs><radialGradient id="egcoG" cx="40%" cy="34%" r="70%"><stop offset="0" stop-color="#f4ead2"/><stop offset="1" stop-color="#b7a37e"/></radialGradient></defs>
<ellipse cx="24" cy="34" rx="19" ry="24" fill="url(#egcoG)" stroke="#8a7754" stroke-width="2"/>
<ellipse cx="17" cy="22" rx="5" ry="7" fill="#fff" opacity=".4"/>
<circle cx="30" cy="26" r="2.4" fill="#9c8a64"/><circle cx="18" cy="40" r="3" fill="#9c8a64"/><circle cx="32" cy="44" r="2" fill="#9c8a64"/><circle cx="24" cy="50" r="2.2" fill="#9c8a64"/></svg>`;
  if(type==='forest') return `<svg viewBox="0 0 48 60" width="${size}" height="${size*1.25}">
<defs><radialGradient id="egfoG" cx="40%" cy="34%" r="72%"><stop offset="0" stop-color="#bfe6a0"/><stop offset="1" stop-color="#3f7a3f"/></radialGradient></defs>
<ellipse cx="24" cy="34" rx="19" ry="24" fill="url(#egfoG)" stroke="#2f5e2f" stroke-width="2"/>
<ellipse cx="17" cy="22" rx="5" ry="7" fill="#fff" opacity=".3"/>
<path d="M24 16 Q19 24 24 30 Q29 24 24 16Z" fill="#2f6e2f" opacity=".8"/>
<path d="M14 38 Q20 32 24 38 Q20 44 14 38Z" fill="#2f6e2f" opacity=".7"/>
<path d="M34 40 Q29 35 24 40 Q29 45 34 40Z" fill="#2f6e2f" opacity=".7"/>
<circle cx="31" cy="26" r="1.6" fill="#d8ffb0"/><circle cx="18" cy="44" r="1.4" fill="#d8ffb0"/></svg>`;
  if(type==='prismatic') return `<svg viewBox="0 0 48 60" width="${size}" height="${size*1.25}">
<defs><linearGradient id="egprG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#aef6ff"/><stop offset=".5" stop-color="#c79bff"/><stop offset="1" stop-color="#7df9ff"/></linearGradient></defs>
<ellipse cx="24" cy="34" rx="19" ry="24" fill="url(#egprG)" stroke="#5fd6ff" stroke-width="2"/>
<path d="M24 10 L34 30 L24 58 L14 30 Z" fill="#fff" opacity=".22"/>
<path d="M14 30 L24 26 L34 30 L24 34 Z" fill="#fff" opacity=".35"/>
<path d="M24 12l1.4 3 3.2.3-2.4 2.2.7 3.1-2.9-1.6-2.9 1.6.7-3.1-2.4-2.2 3.2-.3z" fill="#fff"/></svg>`;
  return `<svg viewBox="0 0 48 60" width="${size}" height="${size*1.25}">
<defs><radialGradient id="egcsG" cx="42%" cy="34%" r="72%"><stop offset="0" stop-color="#3a2f66"/><stop offset="1" stop-color="#0c0a1e"/></radialGradient></defs>
<ellipse cx="24" cy="34" rx="19" ry="24" fill="url(#egcsG)" stroke="#2bd9d9" stroke-width="2"/>
<circle cx="18" cy="24" r="1.4" fill="#fff"/><circle cx="30" cy="20" r="1" fill="#aef6ff"/><circle cx="33" cy="34" r="1.3" fill="#fff"/><circle cx="16" cy="40" r="1.1" fill="#7df9ff"/><circle cx="26" cy="46" r="1" fill="#fff"/>
<path d="M14 34 Q24 26 34 34 Q24 42 14 34Z" fill="#2bd9d9" opacity=".4"/>
<path d="M24 12l1.6 3.4 3.7.4-2.8 2.6.8 3.6-3.3-1.9-3.3 1.9.8-3.6-2.8-2.6 3.7-.4z" fill="#fff" opacity=".9"/></svg>`;
}
export const PET_BODY = {
Dog:`<ellipse cx="20" cy="24" rx="7" ry="11" fill="#9c7a4e"/><ellipse cx="44" cy="24" rx="7" ry="11" fill="#9c7a4e"/><ellipse cx="32" cy="34" rx="17" ry="15" fill="#caa472"/><ellipse cx="32" cy="42" rx="10" ry="8" fill="#ecdcb8"/><ellipse cx="32" cy="39" rx="3.2" ry="2.4" fill="#3a2a18"/><circle cx="24" cy="31" r="2.6" fill="#2a1c10"/><circle cx="40" cy="31" r="2.6" fill="#2a1c10"/><circle cx="25" cy="30" r="0.9" fill="#fff"/><circle cx="41" cy="30" r="0.9" fill="#fff"/>`,
Cat:`<path d="M16 18 L22 31 L11 28 Z" fill="#9a9a9a"/><path d="M48 18 L42 31 L53 28 Z" fill="#9a9a9a"/><ellipse cx="32" cy="34" rx="17" ry="15" fill="#c8c8c8"/><ellipse cx="24" cy="32" rx="3" ry="4.2" fill="#7be08a"/><ellipse cx="40" cy="32" rx="3" ry="4.2" fill="#7be08a"/><ellipse cx="24" cy="32" rx="1" ry="3.2" fill="#13202a"/><ellipse cx="40" cy="32" rx="1" ry="3.2" fill="#13202a"/><path d="M32 39 l-2 2 2 1 2-1z" fill="#ff8aa0"/><g stroke="#9a9a9a" stroke-width="1"><line x1="20" y1="40" x2="10" y2="38"/><line x1="20" y1="42" x2="11" y2="45"/><line x1="44" y1="40" x2="54" y2="38"/><line x1="44" y1="42" x2="53" y2="45"/></g>`,
Goat:`<path d="M20 18 Q12 10 16 24" fill="none" stroke="#cdbd98" stroke-width="3.4"/><path d="M44 18 Q52 10 48 24" fill="none" stroke="#cdbd98" stroke-width="3.4"/><ellipse cx="32" cy="32" rx="14" ry="15" fill="#e6ddc6"/><ellipse cx="32" cy="46" rx="7" ry="8" fill="#d4c8a8"/><circle cx="26" cy="30" r="2.4" fill="#2a2418"/><circle cx="38" cy="30" r="2.4" fill="#2a2418"/><ellipse cx="32" cy="40" rx="2" ry="2.6" fill="#3a3022"/><path d="M29 50 Q32 56 35 50" fill="#cdbd98"/>`,
Lizard:`<path d="M14 38 Q4 38 8 30 Q12 36 18 34Z" fill="#5bb85b"/><ellipse cx="34" cy="34" rx="20" ry="11" fill="#6fd06f"/><ellipse cx="50" cy="30" rx="9" ry="8" fill="#7be07b"/><circle cx="52" cy="28" r="2.4" fill="#163a16"/><circle cx="52.6" cy="27.4" r="0.8" fill="#fff"/><ellipse cx="26" cy="44" rx="3" ry="5" fill="#4ca84c"/><ellipse cx="40" cy="44" rx="3" ry="5" fill="#4ca84c"/><path d="M20 28 Q34 22 48 27" fill="none" stroke="#4ca84c" stroke-width="2" opacity=".6"/>`,
Dragon:`<path class="bd-flap" d="M30 30 L6 18 Q12 34 30 38Z" fill="#b8341c"/><path class="bd-flap" d="M34 30 L58 18 Q52 34 34 38Z" fill="#b8341c"/><path d="M22 16 L24 8 L28 16Z" fill="#7a1d0e"/><path d="M42 16 L40 8 L36 16Z" fill="#7a1d0e"/><ellipse cx="32" cy="32" rx="15" ry="14" fill="#ff5a3c"/><ellipse cx="32" cy="42" rx="9" ry="7" fill="#ff8a64"/><circle cx="28" cy="41" r="1.2" fill="#5a1408"/><circle cx="36" cy="41" r="1.2" fill="#5a1408"/><circle cx="26" cy="30" r="3" fill="#ffe27a"/><circle cx="38" cy="30" r="3" fill="#ffe27a"/><circle cx="26" cy="30" r="1.2" fill="#222"/><circle cx="38" cy="30" r="1.2" fill="#222"/>`,
Phoenix:`<path d="M24 36 Q8 32 3 42 Q14 40 24 42Z" fill="#be2810"/><path d="M24 33 Q8 26 5 36 Q14 34 24 37Z" fill="#ff5e1f"/><path d="M24 31 Q10 22 11 31 Q17 31 24 35Z" fill="#ffb136"/><path class="bd-flap" d="M30 30 Q49 15 59 24 Q46 31 34 39Z" fill="#ff7a1c"/><ellipse cx="33" cy="35" rx="13" ry="11" fill="#ff8a3d"/><ellipse cx="35" cy="37" rx="8" ry="4" fill="#ffdc82"/><path d="M42 23 Q40 13 44 15 Q43 19 46 24Z" fill="#ff8a3d"/><path d="M45 22 Q46 12 50 16 Q47 19 49 24Z" fill="#ffb136"/><circle cx="44" cy="28" r="6" fill="#ffae3b"/><path d="M49 26 L58 28.5 L49 31Z" fill="#ffd98c"/><circle cx="45" cy="27" r="1.4" fill="#2a0a00"/>`,
Pegasus:`<path class="bd-flap" d="M28 28 Q6 18 8 34 Q20 34 28 38Z" fill="#eaf2ff"/><ellipse cx="36" cy="32" rx="13" ry="13" fill="#dce8ff"/><path d="M44 24 Q53 22 52 31 L45 30Z" fill="#dce8ff"/><path d="M30 20 Q28 12 34 14 Q32 18 35 22Z" fill="#b9d0ff"/><circle cx="42" cy="30" r="2.2" fill="#2a3a5a"/><ellipse cx="49" cy="33" rx="3.5" ry="2.6" fill="#cfe0ff"/>`,
Unicorn:`<path d="M35 14 L41 2 L38 15Z" fill="#ffe27a"/><path d="M28 18 Q22 10 30 10 Q26 16 30 22Z" fill="#a86bff"/><path d="M31 16 Q24 14 24 22" stroke="#ff6fae" stroke-width="3" fill="none"/><path d="M31 18 Q24 18 22 26" stroke="#7df9ff" stroke-width="3" fill="none"/><ellipse cx="36" cy="34" rx="13" ry="13" fill="#ffd0ea"/><path d="M44 26 Q53 24 52 33 L45 32Z" fill="#ffd0ea"/><circle cx="42" cy="32" r="2.4" fill="#5a2a4a"/><path d="M50 16l1 2.4 2.6.3-1.9 1.8.5 2.6-2.2-1.3-2.2 1.3.5-2.6-1.9-1.8 2.6-.3z" fill="#fff"/>`,
CosmicFish:`<path d="M44 32 L58 22 L56 42Z" fill="#1c9aa8"/><ellipse cx="30" cy="32" rx="20" ry="13" fill="#2bd9d9"/><path d="M26 20 Q33 12 40 21Z" fill="#1c9aa8"/><ellipse cx="30" cy="36" rx="16" ry="6" fill="#aef6ff" opacity=".45"/><path d="M34 25l1 2.1 2.3.2-1.7 1.5.5 2.2-2.1-1.1-2.1 1.1.5-2.2-1.7-1.5 2.3-.2z" fill="#fff"/><circle cx="40" cy="34" r="1.2" fill="#bfeaff"/><circle cx="26" cy="38" r="1.1" fill="#fff"/><circle cx="38" cy="24" r="1" fill="#ffe27a"/><circle cx="18" cy="30" r="3.6" fill="#fff"/><circle cx="18" cy="30" r="1.8" fill="#0c2a30"/><circle cx="11" cy="19" r="2.2" fill="none" stroke="#aee4ff" stroke-width="1"/><circle cx="16" cy="13" r="1.4" fill="none" stroke="#aee4ff" stroke-width="0.8"/>`,
Parasite:`<ellipse cx="32" cy="32" rx="25" ry="21" fill="#0a0414" opacity=".55"/><path d="M14 46 Q9 53 13 58 M50 46 Q55 53 51 58 M32 51 Q32 60 30 62" stroke="#3a1258" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M8 32 Q20 12 32 12 Q44 12 56 32 Q44 52 32 52 Q20 52 8 32Z" fill="#040108" stroke="#76205c" stroke-width="1.5"/><circle cx="32" cy="32" r="13" fill="#3a1258"/><circle cx="32" cy="32" r="10" fill="none" stroke="#5a1c86" stroke-width="1"/><circle cx="32" cy="32" r="6.5" fill="#7a2aa8"/><ellipse cx="32" cy="32" rx="2.4" ry="8" fill="#0a0208"/><path d="M21 32 Q32 30 43 32" stroke="#c43aa0" stroke-width="1" fill="none" opacity=".6"/>`,
ShooShi:`<path d="M16 40 Q12 56 17 58 M24 44 Q22 58 28 57 M32 45 Q32 60 37 58 M40 44 Q42 58 47 57 M48 40 Q53 56 48 58" stroke="#4a2080" stroke-width="4.5" fill="none" stroke-linecap="round"/><ellipse cx="32" cy="33" rx="18" ry="18" fill="#6a32a6"/><ellipse cx="26" cy="27" rx="11" ry="11" fill="#a96fe0" opacity=".5"/><ellipse cx="20" cy="38" rx="3.5" ry="2.2" fill="#ff78c8" opacity=".5"/><ellipse cx="44" cy="38" rx="3.5" ry="2.2" fill="#ff78c8" opacity=".5"/><ellipse cx="25" cy="31" rx="4" ry="5" fill="#fdf7ff"/><ellipse cx="39" cy="31" rx="4" ry="5" fill="#fdf7ff"/><circle cx="25.6" cy="32" r="2" fill="#1a0a2a"/><circle cx="39.6" cy="32" r="2" fill="#1a0a2a"/><path d="M27 40 Q32 44 37 40" stroke="#1a0a2a" stroke-width="1.6" fill="none"/><rect x="22" y="12" width="20" height="7" rx="3" fill="#fbf7ef"/><circle cx="26" cy="10" r="5" fill="#fbf7ef"/><circle cx="32" cy="8" r="6" fill="#fbf7ef"/><circle cx="38" cy="10" r="5" fill="#fbf7ef"/>`,
Tiki:`<ellipse cx="20" cy="49" rx="7" ry="5" fill="#2d5225"/><ellipse cx="44" cy="49" rx="7" ry="5" fill="#2d5225"/><ellipse cx="32" cy="38" rx="20" ry="16" fill="#365a2a"/><ellipse cx="32" cy="43" rx="11" ry="9" fill="#d4d0be"/><ellipse cx="20" cy="22" rx="9" ry="9" fill="#2a4820"/><ellipse cx="44" cy="22" rx="9" ry="9" fill="#2a4820"/><circle cx="20" cy="22" r="6" fill="#9fb4c4"/><circle cx="44" cy="22" r="6" fill="#9fb4c4"/><rect x="17" y="19" width="6" height="6" rx="1" fill="#1a2630"/><rect x="41" y="19" width="6" height="6" rx="1" fill="#1a2630"/><rect x="18.6" y="20.6" width="2.8" height="2.8" fill="#b03030"/><rect x="42.6" y="20.6" width="2.8" height="2.8" fill="#b03030"/><path d="M32 41 Q31 52 29 58" stroke="#7030c0" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="29" cy="58" rx="3.2" ry="2.4" fill="#6828b0"/><path d="M24 45 Q32 49 40 45" stroke="#253d1c" stroke-width="1.6" fill="none"/>`,
Kebab:`<line x1="32" y1="6" x2="32" y2="58" stroke="#c9c2b0" stroke-width="2.4"/><circle cx="32" cy="16" r="8" fill="#8a4a22"/><rect x="24" y="24" width="16" height="9" rx="2" fill="#5bbf4a"/><circle cx="32" cy="38" r="8" fill="#a05a2a"/><rect x="24" y="46" width="16" height="8" rx="2" fill="#e03050"/><circle cx="28" cy="14" r="1.4" fill="#b76a3a"/><circle cx="35" cy="40" r="1.4" fill="#c07440"/>`,
Bizzy:`<defs><filter id="bzAura"><feGaussianBlur stdDeviation="2"/></filter></defs><g transform="translate(32,32)"><circle cx="0" cy="0" r="12" fill="#ffd23a" opacity="0.15" filter="url(#bzAura)"/><ellipse cx="-3" cy="-7.2" rx="7.5" ry="3.2" fill="#e9f5ff" opacity="0.48" transform="rotate(-24)"/><ellipse cx="3" cy="-5.6" rx="5.5" ry="2.2" fill="#e9f5ff" opacity="0.48" transform="rotate(20)"/><ellipse cx="-3" cy="6" rx="6.8" ry="2.8" fill="#e9f5ff" opacity="0.32" transform="rotate(24)"/><ellipse cx="3" cy="4.8" rx="5" ry="2" fill="#e9f5ff" opacity="0.32" transform="rotate(-20)"/><ellipse cx="-3" cy="-7.2" rx="7.5" ry="3.2" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="0.4" transform="rotate(-24)" opacity="0.45"/><ellipse cx="0" cy="0" rx="7.9" ry="4.7" fill="#ffc20a"/><path d="M-5 -4 L5 -4 L5 4 L-5 4 Z" fill="#ffc20a" clip-path="polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)"/><rect x="-5.3" y="-4.7" width="2.7" height="9.4" fill="rgba(10,4,0,0.82)"/><rect x="0" y="-4.7" width="2.7" height="9.4" fill="rgba(10,4,0,0.82)"/><rect x="5.3" y="-4.7" width="2.7" height="9.4" fill="rgba(10,4,0,0.82)"/><ellipse cx="0" cy="0" rx="7.9" ry="4.7" fill="none" stroke="rgba(80,40,0,0.45)" stroke-width="0.5"/><circle cx="10.1" cy="0" r="3.5" fill="#160c00"/><path d="M-8,-1.2 L-10.8,-1.2 L-10.8,1.2 Z" fill="#3a2000"/><path d="M11.6,-1.5 Q15.8,-8.3 13.5,-11.3" stroke="rgba(12,6,0,0.85)" stroke-width="0.5" fill="none" stroke-linecap="round"/><path d="M11.6,-1.5 Q19.5,-6.8 17.3,-9.8" stroke="rgba(12,6,0,0.85)" stroke-width="0.5" fill="none" stroke-linecap="round"/><circle cx="13.5" cy="-11.3" r="1.3" fill="#160c00"/><circle cx="17.3" cy="-9.8" r="1.3" fill="#160c00"/></g>`,
Muffin:`<path d="M16 33 L48 33 L43 58 L21 58Z" fill="#d96c12"/><path d="M23 33 L21 58 M30 33 L29 58 M37 33 L37 58 M44 33 L43 58" stroke="#5a1c02" stroke-width="2"/><rect x="14" y="30" width="36" height="5" rx="1" fill="#3a1000"/><path d="M15 31 Q15 11 32 11 Q49 11 49 31Z" fill="#7a3010"/><path d="M18 29 Q19 16 32 15 Q45 16 46 29Z" fill="#b05425"/><circle cx="25" cy="25" r="8" fill="#e8e4e0" stroke="#1a1208" stroke-width="1.3"/><circle cx="39" cy="25" r="8" fill="#e8e4e0" stroke="#1a1208" stroke-width="1.3"/><circle cx="26" cy="27" r="3.4" fill="#1a1208"/><circle cx="40" cy="27" r="3.4" fill="#1a1208"/>`,
SHIMMY:`<g class="bd-spin-svg"><path d="M32 2 L36 14 L48 6 L42 18 L56 18 L44 26 L58 32 L44 38 L56 46 L42 46 L48 58 L36 50 L32 62 L28 50 L16 58 L22 46 L8 46 L20 38 L6 32 L20 26 L8 18 L22 18 L16 6 L28 14Z" fill="#fff27a" opacity=".25"/></g><path d="M32 8 L38 26 L57 26 L42 38 L48 56 L32 45 L16 56 L22 38 L7 26 L26 26Z" fill="#ffe24a" stroke="#ffb028" stroke-width="1.5"/><path d="M32 18 L35 28 L45 28 L37 34 L40 44 L32 38 L24 44 L27 34 L19 28 L29 28Z" fill="#fff7c0"/><circle cx="27" cy="30" r="1.8" fill="#a06a00"/><circle cx="37" cy="30" r="1.8" fill="#a06a00"/><path d="M28 35 Q32 38 36 35" stroke="#a06a00" stroke-width="1.4" fill="none"/>`,
};
let _jimmyHappyT=0, _jimmyBounceT=0;
function _jhRound(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const _SS_INK = '#0c0512';
function _ssNigiri(ctx, x, y, s, kind){
  ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round';
  ctx.fillStyle = '#f3ecda'; ctx.strokeStyle = _SS_INK; ctx.lineWidth = Math.max(1.4, s * 0.04);
  _jhRound(ctx, -s * 0.6, -s * 0.12, s * 1.2, s * 0.5, s * 0.2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-s * 0.4 + i * s * 0.26, s * 0.2, s * 0.05, 0, 7); ctx.fill(); }
  const top = kind === 0 ? '#ff9a5c' : kind === 1 ? '#e2455f' : '#f7c9bd';
  const g = ctx.createLinearGradient(0, -s * 0.5, 0, 0); g.addColorStop(0, top); g.addColorStop(1, kind === 1 ? '#b8324a' : '#e07a45');
  ctx.fillStyle = g; ctx.lineWidth = Math.max(1.4, s * 0.04);
  ctx.beginPath(); ctx.moveTo(-s * 0.62, -s * 0.04); ctx.quadraticCurveTo(0, -s * 0.62, s * 0.62, -s * 0.04);
  ctx.quadraticCurveTo(s * 0.5, s * 0.08, 0, s * 0.06); ctx.quadraticCurveTo(-s * 0.5, s * 0.08, -s * 0.62, -s * 0.04); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath(); ctx.moveTo(-s * 0.34, -s * 0.18); ctx.quadraticCurveTo(0, -s * 0.34, s * 0.34, -s * 0.16); ctx.stroke();
  ctx.restore();
}
function _ssOcto(ctx, x, y, s, t){
  ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1, k = i % 4;
    const bx = side * (s * 0.16 + k * s * 0.2);
    const sway = Math.sin(t * 1.5 + i * 0.8) * s * 0.18;
    ctx.strokeStyle = i % 2 ? '#5a2a8f' : '#4a2080'; ctx.lineWidth = s * 0.2 * (1 - k * 0.13);
    ctx.beginPath(); ctx.moveTo(bx, s * 0.55);
    ctx.quadraticCurveTo(bx + sway, s * 1.05, bx + sway * 1.5 + side * s * 0.12, s * 1.45 + Math.cos(t * 1.5 + i) * s * 0.1);
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(-s * 0.2, -s * 0.35, s * 0.1, 0, 0, s * 1.2);
  g.addColorStop(0, '#a96fe0'); g.addColorStop(0.55, '#6a32a6'); g.addColorStop(1, '#341255');
  ctx.fillStyle = g; ctx.strokeStyle = _SS_INK; ctx.lineWidth = Math.max(2, s * 0.04);
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.92, s * 1.02, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,120,200,0.3)';
  ctx.beginPath(); ctx.ellipse(-s * 0.45, s * 0.28, s * 0.16, s * 0.1, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(s * 0.45, s * 0.28, s * 0.16, s * 0.1, 0, 0, 7); ctx.fill();
  const blink = (Math.sin(t * 0.7) > 0.96) ? 0.12 : 1;
  for (const dx of [-1, 1]) {
    ctx.fillStyle = '#fdf7ff'; ctx.strokeStyle = _SS_INK; ctx.lineWidth = Math.max(1.5, s * 0.025);
    ctx.beginPath(); ctx.ellipse(dx * s * 0.32, -s * 0.08, s * 0.2, s * 0.24 * blink, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = _SS_INK; ctx.beginPath(); ctx.ellipse(dx * s * 0.36, -s * 0.04, s * 0.1, s * 0.13 * blink, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(dx * s * 0.32, -s * 0.1, s * 0.035, 0, 7); ctx.fill();
  }
  ctx.strokeStyle = _SS_INK; ctx.lineWidth = Math.max(1.6, s * 0.03);
  ctx.beginPath(); ctx.arc(0, s * 0.16, s * 0.16, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.fillStyle = '#fbf7ef'; ctx.lineWidth = Math.max(2, s * 0.035);
  _jhRound(ctx, -s * 0.34, -s * 1.02, s * 0.68, s * 0.26, s * 0.1); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-s * 0.26, -s * 1.16, s * 0.2, s * 0.2, 0, 0, 7);
  ctx.ellipse(0, -s * 1.26, s * 0.24, s * 0.24, 0, 0, 7);
  ctx.ellipse(s * 0.26, -s * 1.16, s * 0.2, s * 0.2, 0, 0, 7);
  ctx.fill(); ctx.stroke();
  const lift = Math.sin(t * 2.4) * s * 0.08;
  ctx.strokeStyle = '#7b3fb0'; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(s * 0.6, s * 0.5); ctx.quadraticCurveTo(s * 1.15, s * 0.2, s * 1.05, -s * 0.25 + lift); ctx.stroke();
  ctx.fillStyle = 'rgba(255,160,220,0.7)';
  for (let i = 0; i < 4; i++) { const tt = i / 3; const px = s * 0.6 + (s * 0.45) * tt + Math.sin(tt * 3) * s * 0.1, py = s * 0.5 - s * 0.75 * tt + lift * tt; ctx.beginPath(); ctx.arc(px + s * 0.06, py, s * 0.035, 0, 7); ctx.fill(); }
  _ssNigiri(ctx, s * 1.05, -s * 0.42 + lift, s * 0.36, 0);
  ctx.restore();
}
function _hrHash(i){ const v = Math.sin(i * 61.17 + 9.3) * 43758.5453; return v - Math.floor(v); }
function _hrDrawEye(ctx, cx, cy, sz, open01, lookA, glow, seed){
  if (open01 <= 0.02) return;
  const PI2 = Math.PI * 2;
  const s1 = _hrHash((seed||0)*13+2), s2 = _hrHash((seed||0)*29+5), s3 = _hrHash((seed||0)*7+11);
  const w = sz, h = sz * 0.6 * open01;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate((s3 - 0.5) * 0.3);
  const lid = () => {
    ctx.beginPath(); ctx.moveTo(-w, 0);
    ctx.quadraticCurveTo(-w * 0.55, -h * (1.6 + s1 * 0.7), -w * (0.18 - s2 * 0.12), -h * (1.85 + s2 * 0.5));
    ctx.quadraticCurveTo(w * 0.42, -h * (1.7 + s1 * 0.4), w, 0);
    ctx.quadraticCurveTo(w * 0.5, h * (1.5 + s2 * 0.6), -w * 0.1, h * (1.7 + s1 * 0.45));
    ctx.quadraticCurveTo(-w * 0.6, h * 1.5, -w, 0); ctx.closePath();
  };
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.ellipse(0, 0, w * 1.28, h * 2.2, 0, 0, PI2); ctx.fill();
  lid(); ctx.fillStyle = '#040108'; ctx.fill();
  ctx.strokeStyle = `rgba(118,32,92,${(0.30 + glow * 0.22).toFixed(3)})`; ctx.lineWidth = 1; ctx.stroke();
  ctx.clip();
  ctx.fillStyle = 'rgba(38,13,58,0.35)';
  ctx.beginPath(); ctx.ellipse(0, 0, w * 0.8, h * 1.4, 0, 0, PI2); ctx.fill();
  const ix = Math.cos(lookA) * w * 0.24, iy = Math.sin(lookA) * h * 0.55;
  ctx.fillStyle = `rgba(58,18,88,${(0.45 + glow * 0.2).toFixed(3)})`;
  ctx.beginPath(); ctx.arc(ix, iy, sz * 0.42, 0, PI2); ctx.fill();
  for (let r = 3; r >= 1; r--) {
    ctx.strokeStyle = `rgba(${86 + r * 16},${18 + r * 7},${124 + r * 18},${(0.15 + glow * 0.10).toFixed(3)})`;
    ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ix, iy, sz * 0.13 * r, 0, PI2); ctx.stroke();
  }
  ctx.save(); ctx.translate(ix, iy); ctx.rotate(Math.sin(lookA) * 0.2);
  ctx.fillStyle = `rgba(142,38,108,${(0.30 + glow * 0.28).toFixed(3)})`;
  ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.12, sz * 0.46, 0, 0, PI2); ctx.fill();
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.075, sz * 0.4, 0, 0, PI2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(105,24,66,0.42)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-w, 0); ctx.quadraticCurveTo(-w * 0.6, -h * 0.4, -w * 0.35 + ix * 0.3, iy * 0.5 - h * 0.2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w, 0); ctx.quadraticCurveTo(w * 0.6, h * 0.5, w * 0.4 + ix * 0.3, iy * 0.5 + h * 0.3); ctx.stroke();
  ctx.restore();
}
function _smStar4(ctx, x, y, r, elong, col, alpha){
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(x, y - r * (elong || 1.4));
  ctx.quadraticCurveTo(x + r * 0.22, y - r * 0.22, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.22, y + r * 0.22, x, y + r * (elong || 1.4));
  ctx.quadraticCurveTo(x - r * 0.22, y + r * 0.22, x - r, y);
  ctx.quadraticCurveTo(x - r * 0.22, y - r * 0.22, x, y - r * (elong || 1.4));
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function _smConstFish(ctx, t, ph){
  const flick = Math.sin(t * 5 + ph) * 2.5;
  const pts = [[15,0],[5,-6],[-9,-4+flick],[-15,flick*1.4],[-9,4+flick],[5,6]];
  ctx.strokeStyle = 'rgba(190,235,255,0.4)'; ctx.lineWidth = 0.9; ctx.beginPath();
  for (let i = 0; i <= pts.length; i++){ const p = pts[i % pts.length]; i === 0 ? ctx.moveTo(p[0],p[1]) : ctx.lineTo(p[0],p[1]); }
  ctx.stroke();
  for (let i = 0; i < pts.length; i++){ const tw = 0.55 + 0.45 * Math.sin(t*3+ph+i*1.9);
    _smStar4(ctx, pts[i][0], pts[i][1], 2.2+tw, 1.5, i===0?'#ffe27a':'#cfeeff', 0.5+tw*0.5); }
}
function _rgDrawPhoenix(ctx, s, flap, t, glow){
  const PI2 = Math.PI * 2; ctx.save(); ctx.scale(s, s);
  const wing = Math.sin(flap); const g = Math.max(0, Math.min(1, glow || 0));
  for (let r = 0; r < 3; r++) {
    const off = (r - 1) * 5; const wav = Math.sin(t*6+r*2.1)*6; const wav2 = Math.sin(t*4.5+r*1.3)*9; const len = 52 + r*10;
    ctx.beginPath(); ctx.moveTo(-10, off*0.4);
    ctx.bezierCurveTo(-24, off+wav*0.5, -36, off+wav, -len, off*1.6+wav2);
    ctx.bezierCurveTo(-36, off+wav+3, -24, off+wav*0.5+3, -10, off*0.4+2.5);
    ctx.closePath();
    const ta = 0.5 - r*0.12 + g*0.3;
    ctx.fillStyle = r===0?`rgba(255,177,54,${ta.toFixed(3)})`:r===1?`rgba(255,94,31,${ta.toFixed(3)})`:`rgba(190,40,16,${ta.toFixed(3)})`;
    ctx.fill();
  }
  const wingShape = (dir, lift) => {
    ctx.beginPath(); ctx.moveTo(2, -3);
    ctx.bezierCurveTo(8, -10 - lift*0.6, 18, -16 - lift, 30, -18 - lift*1.35);
    ctx.lineTo(24, -12 - lift*0.95); ctx.lineTo(27, -8 - lift*0.8); ctx.lineTo(20, -5 - lift*0.55);
    ctx.lineTo(23, -1 - lift*0.4); ctx.lineTo(12, 1 - lift*0.15); ctx.closePath();
  };
  ctx.save(); ctx.translate(-2, 1); ctx.scale(0.92, 1); wingShape(-1, wing*13 - 3);
  ctx.fillStyle = `rgba(170,40,14,${(0.55 + g*0.3).toFixed(3)})`; ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.moveTo(16, -1);
  ctx.bezierCurveTo(12, -7, 0, -7.5, -9, -3.5); ctx.bezierCurveTo(-12, -1.5, -12, 2.5, -8, 4.2);
  ctx.bezierCurveTo(0, 7.5, 12, 5.5, 16, -1); ctx.closePath();
  ctx.fillStyle = `rgba(255,${Math.round(120+g*90)},${Math.round(34+g*120)},0.95)`; ctx.fill();
  ctx.beginPath(); ctx.ellipse(2, 0.5, 8, 3.4, -0.15, 0, PI2);
  ctx.fillStyle = `rgba(255,220,130,${(0.5+g*0.4).toFixed(3)})`; ctx.fill();
  ctx.beginPath(); ctx.arc(17.5, -3.5, 4.4, 0, PI2); ctx.fillStyle = `rgba(255,${Math.round(150+g*70)},50,0.97)`; ctx.fill();
  ctx.beginPath(); ctx.moveTo(21.2, -4.6); ctx.lineTo(26.5, -3.1); ctx.lineTo(21.2, -1.7); ctx.closePath(); ctx.fillStyle = '#ffd98c'; ctx.fill();
  for (let k = 0; k < 3; k++) {
    const ca = -1.9 + k*0.45 + Math.sin(t*7+k)*0.1;
    ctx.beginPath(); ctx.moveTo(16.5+k*1.2, -7);
    ctx.quadraticCurveTo(15+k*1.4+Math.cos(ca)*4, -13-k, 14+k*2.2, -14.5-k*1.5);
    ctx.quadraticCurveTo(17+k*1.4, -11, 18+k*1.2, -7.2); ctx.closePath();
    ctx.fillStyle = `rgba(255,140,40,${(0.7-k*0.15).toFixed(3)})`; ctx.fill();
  }
  ctx.fillStyle = '#2a0a00'; ctx.beginPath(); ctx.arc(18.6, -4.2, 1, 0, PI2); ctx.fill();
  ctx.save(); ctx.translate(0, -1); wingShape(1, wing*16);
  const wg = ctx.createLinearGradient(2, 0, 30, -20);
  wg.addColorStop(0, 'rgba(255,196,80,0.95)'); wg.addColorStop(1, 'rgba(255,80,24,0.85)');
  ctx.fillStyle = wg; ctx.fill(); ctx.restore();
  ctx.restore();
}
function _drawKatieFrog(ctx, x, y, ang, spd, t){
  const norm = Math.min(1, spd/350); const sqX = 1 + norm*0.22; const sqY = 1 - norm*0.14;
  const hop = spd > 30 ? Math.abs(Math.sin(t*13))*Math.min(10, spd*0.035) : 0;
  const blink = Math.sin(t*1.7) > 0.94;
  ctx.save(); ctx.translate(x, y - hop); ctx.rotate(ang); ctx.scale(sqX, sqY);
  const BW = 24, BH = 20;
  const wag = Math.sin(t*9+spd*0.05)*(5+norm*22);
  const mouthY = -BH*0.28; const tongueLen = BH*0.45+10+norm*18+Math.abs(Math.sin(t*3.5))*7; const tipY = mouthY - tongueLen;
  ctx.save(); ctx.shadowBlur = 6; ctx.shadowColor = '#5520a0';
  ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#7030c0';
  ctx.beginPath(); ctx.moveTo(0, mouthY);
  ctx.bezierCurveTo(wag*0.3, mouthY-tongueLen*0.35, wag*0.75, mouthY-tongueLen*0.68, wag, tipY); ctx.stroke();
  ctx.fillStyle = '#6828b0'; ctx.beginPath(); ctx.ellipse(wag, tipY, 6, 4, Math.atan2(-tongueLen, wag), 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0; ctx.restore();
  for (const s of [-1,1]) { ctx.save(); ctx.translate(s*BW*0.78, BH*0.55); ctx.rotate(s*0.4);
    ctx.beginPath(); ctx.ellipse(s*3, 5, 8, 6, s*0.3, 0, Math.PI*2); ctx.fillStyle = '#2d5225'; ctx.fill(); ctx.restore(); }
  for (const s of [-1,1]) { ctx.save(); ctx.translate(s*BW*0.7, BH*0.05); ctx.rotate(s*0.55);
    ctx.beginPath(); ctx.ellipse(s*2.5, 4, 6, 4.5, s*0.25, 0, Math.PI*2); ctx.fillStyle = '#2d5225'; ctx.fill(); ctx.restore(); }
  const bg = ctx.createRadialGradient(-BW*0.25, -BH*0.25, 2, 0, 0, BW*1.1);
  bg.addColorStop(0,'#4a7038'); bg.addColorStop(0.65,'#365a2a'); bg.addColorStop(1,'#253d1c');
  ctx.beginPath(); ctx.ellipse(0, 0, BW, BH, 0, 0, Math.PI*2); ctx.fillStyle = bg;
  ctx.shadowBlur = 12; ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.fill(); ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.ellipse(0, BH*0.18, BW*0.56, BH*0.56, 0, 0, Math.PI*2); ctx.fillStyle = '#d4d0be'; ctx.fill();
  const EX = BW*0.52, EY_base = -BH*0.55, ER = 8;
  for (const s of [-1,1]) {
    const ex = s*EX, ey = EY_base;
    ctx.beginPath(); ctx.ellipse(ex, ey, ER+2, ER+1.5, 0, 0, Math.PI*2); ctx.fillStyle = '#2a4820'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(ex, ey, ER, ER*0.92, 0, 0, Math.PI*2); ctx.fillStyle = '#8ab4c8'; ctx.fill();
    if (blink) { ctx.save(); ctx.beginPath(); ctx.moveTo(ex-ER*0.6, ey); ctx.lineTo(ex+ER*0.6, ey);
      ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore(); }
    else { const pw = ER*0.7, ph = ER*0.82; ctx.fillStyle = '#0a0a0a'; ctx.beginPath();
      ctx.moveTo(ex-pw*0.5+2, ey-ph*0.5); ctx.lineTo(ex+pw*0.5-2, ey-ph*0.5);
      ctx.arcTo(ex+pw*0.5, ey-ph*0.5, ex+pw*0.5, ey-ph*0.5+2, 2); ctx.lineTo(ex+pw*0.5, ey+ph*0.5-2);
      ctx.arcTo(ex+pw*0.5, ey+ph*0.5, ex+pw*0.5-2, ey+ph*0.5, 2); ctx.lineTo(ex-pw*0.5+2, ey+ph*0.5);
      ctx.arcTo(ex-pw*0.5, ey+ph*0.5, ex-pw*0.5, ey+ph*0.5-2, 2); ctx.lineTo(ex-pw*0.5, ey-ph*0.5+2);
      ctx.arcTo(ex-pw*0.5, ey-ph*0.5, ex-pw*0.5+2, ey-ph*0.5, 2); ctx.closePath(); ctx.fill(); }
    const icx = ex - s*ER*0.42, icy = ey+ER*0.3;
    ctx.beginPath(); ctx.ellipse(icx, icy, ER*0.42, ER*0.28, s*0.4, 0, Math.PI*2); ctx.fillStyle = 'rgba(130,10,0,0.82)'; ctx.fill();
    ctx.beginPath(); ctx.arc(ex-ER*0.32, ey-ER*0.32, ER*0.21, 0, Math.PI*2); ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.fill();
  }
  ctx.restore();
}
function _drawJimmyMuffin(ctx, cx, cy, t, scale, curX, curY){
  const happy = _jimmyHappyT; const bobY = Math.sin(t*1.5)*5 - happy*4; const breathe = 1 + Math.sin(t*1.1)*0.012;
  const bT = _jimmyBounceT; const sq = bT > 0 ? Math.sin(bT*Math.PI*3.2)*bT*0.42 : 0;
  const sX = (1+sq*0.30)*breathe, sY = (1-sq*0.38)*breathe;
  ctx.save(); ctx.translate(cx, cy+bobY); const sxx = scale*sX, syy = scale*sY; ctx.scale(sxx, syy);
  const lcx = (curX-cx)/sxx, lcy = (curY-(cy+bobY))/syy;
  const eyeR = 14, eyeOX = 18, eyeY = 0; const cupTW = 19, cupBW = 14, cupH = 22;
  const cupTopY = eyeY+eyeR, cupBotY = cupTopY+cupH; const domeR = 16, domeY = cupTopY-domeR;
  ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = '#2a1604';
  ctx.beginPath(); ctx.ellipse(0, cupBotY+7, cupTW*1.15, 7, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.moveTo(-cupTW, cupTopY); ctx.lineTo(-cupBW, cupBotY); ctx.lineTo(cupBW, cupBotY); ctx.lineTo(cupTW, cupTopY); ctx.closePath();
  const wg = ctx.createLinearGradient(-cupTW, 0, cupTW, 0);
  wg.addColorStop(0, '#993e04'); wg.addColorStop(0.18, '#d96c12'); wg.addColorStop(0.50, '#ee8c28'); wg.addColorStop(0.82, '#d96c12'); wg.addColorStop(1, '#993e04');
  ctx.fillStyle = wg; ctx.fill(); ctx.clip();
  ctx.strokeStyle = 'rgba(38,10,0,0.62)'; ctx.lineWidth = 2.8;
  for (let i = 0; i <= 6; i++) { const f = i/6; ctx.beginPath(); ctx.moveTo(-cupTW+f*cupTW*2, cupTopY); ctx.lineTo(-cupBW+f*cupBW*2, cupBotY); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = 'rgba(40,10,0,0.88)'; ctx.beginPath();
  ctx.moveTo(-cupTW-1, cupTopY-1); ctx.lineTo(cupTW+1, cupTopY-1); ctx.lineTo(cupTW+1, cupTopY+4); ctx.lineTo(-cupTW-1, cupTopY+4); ctx.closePath(); ctx.fill();
  const dg = ctx.createRadialGradient(-domeR*0.28, domeY-domeR*0.28, 2, 0, domeY, domeR*1.05);
  dg.addColorStop(0, '#b05425'); dg.addColorStop(0.40, '#7a3010'); dg.addColorStop(1, '#2e0e02');
  ctx.beginPath(); ctx.arc(0, domeY, domeR, 0, Math.PI*2); ctx.fillStyle = dg; ctx.fill();
  for (let sgn = -1; sgn <= 1; sgn += 2) {
    const ex = sgn*eyeOX; const er = eyeR + happy*1.6;
    ctx.beginPath(); ctx.arc(ex, eyeY, er, 0, Math.PI*2); ctx.fillStyle = '#e8e4e0'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.70)'; ctx.lineWidth = 1.8; ctx.stroke();
    let dx = lcx-ex, dy = lcy-eyeY; const d = Math.hypot(dx, dy)||1; const reach = Math.min(er*0.40, d);
    const px = ex+(dx/d)*reach, py = eyeY+(dy/d)*reach;
    ctx.beginPath(); ctx.arc(px, py, er*0.58, 0, Math.PI*2); ctx.fillStyle = '#111'; ctx.fill();
    ctx.beginPath(); ctx.arc(px+er*0.19, py-er*0.19, er*0.19, 0, Math.PI*2); ctx.fillStyle = '#fff'; ctx.fill();
  }
  if (happy > 0.02) { for (let sgn = -1; sgn <= 1; sgn += 2) { const er = eyeR+happy*1.6; ctx.globalAlpha = happy*0.50;
    ctx.beginPath(); ctx.ellipse(sgn*(eyeOX+er*0.55), eyeY+er*0.80, er*0.62, er*0.26, 0, 0, Math.PI*2); ctx.fillStyle = '#ff4466'; ctx.fill(); } ctx.globalAlpha = 1; }
  ctx.restore();
}

export function petPaint(ctx, type, W, H, t){
  ctx.clearRect(0,0,W,H); const cx=W/2, cy=H/2; ctx.save();
  if(type==='Phoenix'){ ctx.translate(cx+W*0.06, cy); _rgDrawPhoenix(ctx, W/120, t*7.5, t, 0.12+0.12*Math.sin(t*2)); }
  else if(type==='Tiki'){ const s=W/82; ctx.translate(cx, cy+H*0.05); ctx.scale(s,s); _drawKatieFrog(ctx,0,0,0,0,t); }
  else if(type==='Muffin'){ _drawJimmyMuffin(ctx, cx, cy-H*0.05, t, W/82, cx, cy-H*0.6); }
  else if(type==='ShooShi'){ _ssOcto(ctx, cx-W*0.03, cy-H*0.01, W*0.23, t); }
  else if(type==='Parasite'){ _hrDrawEye(ctx, cx, cy, W/3.0, 1, Math.sin(t*1.2)*1.3, 0.5+0.25*Math.sin(t*3), 7); }
  else if(type==='CosmicFish'){ ctx.translate(cx,cy); const s=W/42; ctx.scale(s,s); _smConstFish(ctx, t, 0); }
  ctx.restore();
}
