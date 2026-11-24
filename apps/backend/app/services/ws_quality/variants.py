"""Variant check: does the dealer's line contradict the dial / bracelet / index of the assigned WS code?

"126234 wim jub" must not land on "126234g Blue Jub"; "6007G Red" must not land on "6007G Yellow".
The catalogue side uses everything it knows about a WS code: the code itself, dial, bracelet and all aliases.
"""
import re
import collections
SYN={
 'color':{
  'black':['blk','bk','black','noir','schwarz','onyx'],'white':['wht','wh','white','weiss','bianco'],'blue':['blu','blue','azzurro','azzuro','blau','navy'],
  'green':['grn','green','verde','grün','grun'],'grey':['grey','gray','slate','rhodium','grigio','grau','anthracite','ghost'],'silver':['silver','silv','argento'],
  'champ':['champ','champagne'],'choco':['cho','choc','choco','chocolate','chocolat','brown','coffee'],'pink':['pink','rose','rosa','sun','sundust'],
  'yml':['yml','pika','pikachu'],'yellow':['yellow'],'mete':['mete','meteorite','meteorit','meteor'],'tiffany':['tiff','tiffany','turquoise','turq','tq'],'wimbledon':['wim','wimb','wimbledon','wimbo'],
  'ice':['ice','iceblue'],'mop':['mop','perlmutt','pearl'],'pave':['pave','paved','pavé'],'olive':['olive'],'purple':['purple','aubergine','violet'],'mint':['mint'],
  'lavender':['lavender','lilac'],'pistachio':['pistachio','pista'],'beige':['beige'],'candy':['candy'],'coral':['coral'],'red':['red','rosso'],'orange':['orange'],
  'salmon':['salmon'],'ombre':['ombre','ombré','smoke','smoked'],'panda':['panda'],'cream':['cream','ivory','creme'],'celebration':['celebration','bubble','bubbles','balloon'],
  'palm':['palm'],'fluted':['fluted'],'malachite':['malachite'],'eisenkiesel':['eisenkiesel'],'aventurine':['aventurine'],'tiger':['tiger','tigereye'],'rainbow':['rainbow','rbow'],
  'paulnewman':['pn','paulnewman'],'giraffe':['giraffe'],'leopard':['leopard'],'turkis':['turkis'],'burgundy':['burgundy','bordeaux'],'khaki':['khaki'],'teal':['teal']},
 'bracelet':{'jub':['jub','jubi','jubilee','jubile','jubilé'],'oys':['oys','oyster','oysterbracelet'],'president':['president','pres'],'leather':['leather','strap'],'rubber':['rubber','oysterflex','flex'],'fullgold':['fullgold']},
 'index':{'rom':['rom','roman','roma','romans'],'ind':['ind','index','stick','sticks','baton'],'dia':['diamond','diamonds','dia','diam','g'],'vi':['vi','viix','vix','vxi','ix'],'motif':['motif','fluted','jubileemotif'],'arab':['arabic','arab','arabics'],'a':['a','baguette','bag'],'ng':['ng']},
}
CANON={}
for cls,d in SYN.items():
    for c,ws in d.items():
        for w in ws: CANON.setdefault(w,(cls,c))
NOISE=re.compile(r'\b(?:white|wht|both|green|grey|gray|blue|red|old|new|wood(?:en)?)\s+(?:tags?|cards?|seals?|stickers?|box(?:es)?|papers?)\b|\b(?:white|rose|yellow|pink|red|everose)\s*gold\b|\b(?:wg|rg|yg)\b|\bfull\s*(?:set|links?|stickers?)\b|\b(?:new|old)\s+style\b|\bgreen\s+only\b|\bonly\s+green\b',re.I)
WORD=re.compile(r"[A-Za-zäöüéèÄÖÜ]+")
def words(text,ref_forms=()):
    """Canonical descriptor words of a text, per class."""
    t=NOISE.sub(' ',text)
    t=re.sub(r'(?<=\d)(vi|viix|g|a|ng)\b',r' \1',t,flags=re.I)      # 126231vi -> 126231 vi
    out=collections.defaultdict(set)
    for w in WORD.findall(t.lower()):
        c=CANON.get(w)
        if c: out[c[0]].add(c[1])
    return out
def ws_words(ws,entry):
    """Descriptor words the catalogue knows for a WS code (ws code, dial, bracelet, aliases)."""
    parts=[' '.join(ws.split()[1:]),entry.get('dial') or '',entry.get('bracelet') or '']
    for a in entry.get('aliases') or []: parts.append(' '.join(a.split()[1:]) if re.search(r'\d{3}',a.split()[0] if a.split() else '') else a)
    out=collections.defaultdict(set)
    for p in parts:
        for cls,cs in words(p).items(): out[cls]|=cs
    # suffix letters of the ws code itself (126231g -> dia, 278288NG -> ng/mop, 228238A -> a)
    m=re.match(r'^\d{5,6}([A-Za-z]{1,4})$',ws.split()[0]) if ws.split() else None
    if m:
        suf=m.group(1).upper()
        if suf=='G': out['index'].add('dia')
        if suf in('VI','VIIX'): out['index'].add('vi')
        if suf=='NG': out['index'].add('ng');out['color'].add('mop')
        if suf=='A': out['index'].add('a')
    return out
def fits_strictly(line,ws,entry):
    """For moving an order: every class the line names must agree with the WS code, and at least one must be named."""
    L=words(line);W=ws_words(ws,entry)
    both=[cls for cls in ('color','bracelet','index') if L.get(cls) and W.get(cls)]
    if L.get('color') and not L['color']<=W.get('color',set()): return False      # "ombre green" is not "green palm"
    return bool(both) and all(L[cls]&W[cls] for cls in both)
def check(line,ws,entry):
    """-> 'conflict:<class> text=<..> ws=<..>' | 'confirmed' | 'unspecified'"""
    L=words(line);W=ws_words(ws,entry)
    conf=[];agree=False
    for cls in ('color','bracelet','index'):
        if L.get(cls) and W.get(cls):
            if L[cls]&W[cls]: agree=True
            else: conf.append('%s text=%s ws=%s'%(cls,'/'.join(sorted(L[cls])),'/'.join(sorted(W[cls]))))
    if conf and not (agree and all(c.startswith('index') for c in conf)): return 'conflict:'+'; '.join(conf)
    if agree: return 'confirmed'
    return 'unspecified'
