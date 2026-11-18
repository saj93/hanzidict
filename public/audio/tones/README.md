# Tone practice audio

These 32 MP3 clips were synthesized on 2026-11-18 using HanziDict's existing
Azure Speech endpoint (zh-CN-XiaoxiaoNeural). They are synthetic speech, not
recordings of a human speaker or audio copied from ArchChinese.

The source characters, citation-tone labels, pinyin and glosses are listed in
`content/tone-practice.json`. Character readings are checked against pinyin-pro
by `scripts/tone-practice.test.mjs`. This checks the labels, not an independent
human assessment of the acoustic recordings.

Files are served locally so playback does not need a live TTS request or secret.
The drill uses one syllable at a time and teaches dictionary tones, not
contextual third-tone or yi/bu sandhi. Neutral tone is not included.
Slower playback preserves pitch.
