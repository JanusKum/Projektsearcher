"""Subtitle export with the same rule as the burned-in bar (shown = max(1.8 s, speech + 0.6 s)); times from story.js → cues.json"""
import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'story.js'), encoding='utf-8').read()
vo = re.findall(r"\{ id: '(v\d)', t: ([\d.]+), text: '([^']+)' \}", src)
dur = json.load(open(os.path.join(HERE, 'voices', 'dur.json')))
cues = [{'t0': float(t), 't1': round(float(t) + max(1.8, dur[i] + .6), 3), 'text': txt} for i, t, txt in vo]
json.dump(cues, open(os.path.join(HERE, 'cues.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(len(cues), 'cues')
