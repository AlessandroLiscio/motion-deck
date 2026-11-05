# Credits

## Inspiration

The ship-ai-agents deck by Salvatore Visaggi, [visalvo.github.io/ship-ai-agents](https://visalvo.github.io/ship-ai-agents), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), showed what a browser deck can feel like and set the bar for this project. The technique it demonstrates shaped the design: a fixed stage scaled to any screen, an entrance cascade on every slide, parts of a slide that appear step by step, diagrams written as data and drawn as animated SVG, a living starfield that reacts to navigation, and one story metaphor used in the map and the progress track. The space theme uses the same open fonts (Big Shoulders Display and Atkinson Hyperlegible) and a similar dark palette.

This is an independent implementation. No code, text or artwork from that deck is included here.

## Fonts

All fonts are licensed under the [SIL Open Font License 1.1](https://openfontlicense.org). Each deck embeds the files its theme uses, as served by Google Fonts (latin subset), together with the full license text and each font's copyright notice in one comment block at the top of the built file. The same texts live next to the font files in `skills/motion-deck/themes/_shared/fonts/<id>/OFL.txt`, and `fonts.json` there records the source of every file.

| Family | Copyright | Used by |
|---|---|---|
| Big Shoulders Display | 2019 The Big Shoulders Project Authors, [xotypeco/big_shoulders](https://github.com/xotypeco/big_shoulders) | space |
| Atkinson Hyperlegible Next | 2020-2024 The Atkinson Hyperlegible Next Project Authors, [googlefonts/atkinson-hyperlegible-next](https://github.com/googlefonts/atkinson-hyperlegible-next) | space, skyrim |
| Atkinson Hyperlegible Mono | 2020-2024 The Atkinson Hyperlegible Mono Project Authors, [googlefonts/atkinson-hyperlegible-next-mono](https://github.com/googlefonts/atkinson-hyperlegible-next-mono) | space, skyrim |
| Fraunces | 2018 The Fraunces Project Authors, [undercasetype/Fraunces](https://github.com/undercasetype/Fraunces) | editorial |
| Source Serif 4 | 2014 The Source Serif 4 Project Authors, [adobe-fonts/source-serif](https://github.com/adobe-fonts/source-serif) | editorial |
| JetBrains Mono | 2020 The JetBrains Mono Project Authors, [JetBrains/JetBrainsMono](https://github.com/JetBrains/JetBrainsMono) | editorial, corporate, neon, fantasy, pirates |
| Unbounded | 2022 The Unbounded Project Authors, [googlefonts/unbounded](https://github.com/googlefonts/unbounded) | neon |
| Chakra Petch | 2018 The Chakra Petch Project Authors, [m4rc1e/Chakra-Petch](https://github.com/m4rc1e/Chakra-Petch) | neon |
| Manrope | 2018 The Manrope Project Authors, [googlefonts/manrope](https://github.com/googlefonts/manrope) | corporate, skyrim |
| Cinzel | 2020 The Cinzel Project Authors, [NDISCOVER/Cinzel](https://github.com/NDISCOVER/Cinzel) | fantasy |
| EB Garamond | 2017 The EB Garamond Project Authors, [octaviopardo/EBGaramond12](https://github.com/octaviopardo/EBGaramond12) | fantasy |
| Pirata One | 2012 Rodrigo Fuenzalida and Nicolas Massi, [taip.com.ar](https://www.taip.com.ar), with Reserved Font Name "Pirata" | pirates |
| Alegreya Sans | 2013 The Alegreya Sans Project Authors, [huertatipografica/Alegreya-Sans](https://github.com/huertatipografica/Alegreya-Sans) | pirates |
| Share Tech Mono | 2012 Carrois Type Design, Ralph du Carrois, [carrois.com](https://www.carrois.com), with Reserved Font Name "Share" | pipboy |

## Code

The engine, the scripts, the themes and their line art are original work released under the MIT license in `LICENSE`. The scripts use only Node.js built-ins; nothing is downloaded at build time.

## Trademarks

The pipboy theme is an homage to the look of the Pip-Boy interface in the Fallout games. Fallout and Pip-Boy are trademarks of Bethesda Softworks LLC; motion-deck is not affiliated with or endorsed by them. The theme uses no game artwork, logos, fonts or text: its line art is drawn from scratch.

The skyrim theme is an unofficial homage to the menu interface of Skyrim. Skyrim and The Elder Scrolls are trademarks of Bethesda Softworks LLC and ZeniMax Media Inc.; motion-deck is not affiliated with or endorsed by them. The theme uses no game artwork, logos, fonts, lettering or text: its frames, compass star, helmet constellation and line art are drawn from scratch, and its runes are an angular script of its own design (twelve letters, drawn as SVG strokes), not the game's dragon alphabet.
