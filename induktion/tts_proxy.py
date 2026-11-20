"""Runs $LIB/core/tts/tts_zh.py with edge-tts routed through HTTPS_PROXY (aiohttp ignores it otherwise)."""
import os, sys, runpy, edge_tts
_C = edge_tts.Communicate
class Communicate(_C):
    def __init__(self, *a, **k):
        k.setdefault('proxy', os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy'))
        super().__init__(*a, **k)
edge_tts.Communicate = Communicate
lib = os.environ['LIB']; sys.argv = [lib + '/core/tts/tts_zh.py'] + sys.argv[1:]
runpy.run_path(sys.argv[0], run_name='__main__')
